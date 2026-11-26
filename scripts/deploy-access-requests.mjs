import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'
import { execFileSync } from 'node:child_process'
import {
  Contract,
  ContractFactory,
  JsonRpcProvider,
  Wallet,
  keccak256
} from 'ethers'

const root = fileURLToPath(new URL('../', import.meta.url))
const dir = path.join(root, 'contracts/access-requests')
const args = process.argv.slice(2)
if (args.includes('--help')) {
  console.log(`Deploy the access requests registry to OP Sepolia.
Usage: npm run deploy:access-requests [-- --configure] [--resume]

Requires Node 22 and the local contract sources/dependencies. Uses Foundry (forge)
from PATH or downloads the pinned platform binary with npx.
FORGE_BIN overrides the forge executable.
ACCESS_REQUESTS_KEYSTORE defaults to examples/asset-publication/keys/deployer.json.
ACCESS_REQUESTS_PASSWORD_ENV defaults to examples/asset-publication/.env (UDL_KEY_PASSWORD).
ACCESS_REQUESTS_RPC_URL overrides the configured OP Sepolia transaction relay/read RPC.
--resume completes the saved deployment without broadcasting a new contract.
--configure updates the root .env and regenerates local runtime configuration.
Builds and tests before broadcasting, verifies deployed bytecode/version, saves a
public manifest, and submits source verification to Sourcify. No private key or
password is passed on the command line or written to deployment artifacts.`)
  process.exit(0)
}
if (args.some((arg) => !['--configure', '--resume'].includes(arg)))
  throw new Error('Unknown option; use --help')
const readEnv = (file) =>
  fs.existsSync(file) ? parseEnv(fs.readFileSync(file, 'utf8')) : {}
const env = { ...readEnv(path.join(root, '.env')), ...process.env }
let forge = env.FORGE_BIN || 'forge'
let forgePrefix = []
try {
  execFileSync(forge, ['--version'], { stdio: 'ignore' })
} catch (error) {
  if (env.FORGE_BIN) throw error
  const arch = process.arch === 'x64' ? 'amd64' : process.arch
  forge = process.platform === 'win32' ? 'npx.cmd' : 'npx'
  forgePrefix = [
    '--yes',
    '--package',
    `@foundry-rs/forge-${process.platform}-${arch}@1.7.1`,
    '--',
    'forge'
  ]
}
const run = (cmd, argv, cwd = dir) =>
  execFileSync(cmd, cmd === forge ? [...forgePrefix, ...argv] : argv, {
    cwd,
    stdio: 'inherit'
  })
const hash = (data) => crypto.createHash('sha256').update(data).digest('hex')
async function main() {
  let provider
  try {
    const passwordEnv = readEnv(
      path.resolve(
        root,
        env.ACCESS_REQUESTS_PASSWORD_ENV || 'examples/asset-publication/.env'
      )
    )
    const password = env.UDL_KEY_PASSWORD || passwordEnv.UDL_KEY_PASSWORD
    if (!password) throw new Error('Missing UDL_KEY_PASSWORD')
    const rpc =
      env.ACCESS_REQUESTS_RPC_URL ||
      JSON.parse(env.NEXT_PUBLIC_TRANSACTION_RELAY_MAP || '{}')[11155420] ||
      JSON.parse(env.NEXT_PUBLIC_NODE_URI_MAP || '{}')[11155420]
    if (!rpc) throw new Error('Missing OP Sepolia RPC configuration')
    provider = new JsonRpcProvider(rpc)
    provider.pollingInterval = 2000
    if ((await provider.getNetwork()).chainId !== 11155420n)
      throw new Error('Deployment requires OP Sepolia (11155420)')
    run(forge, ['test'])
    run(forge, ['build'])
    run(process.execPath, ['tools/export-abi.mjs'])
    const artifact = JSON.parse(
      fs.readFileSync(
        path.join(dir, 'out/AccessRequests.sol/AccessRequests.json')
      )
    )
    const manifestFile = path.join(dir, 'deployment.v6.op-sepolia.json')
    let manifest
    if (args.includes('--resume')) {
      manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'))
      if (
        manifest.chainId !== 11155420 ||
        manifest.sourceSha256 !==
          hash(fs.readFileSync(path.join(dir, 'src/AccessRequests.sol')))
      )
        throw new Error('Resume source/chain mismatch')
    } else {
      if (fs.existsSync(manifestFile)) {
        fs.copyFileSync(
          manifestFile,
          manifestFile.replace('.json', `.${Date.now()}.json`)
        )
      }
      const wallet = (
        await Wallet.fromEncryptedJson(
          fs.readFileSync(
            path.resolve(
              root,
              env.ACCESS_REQUESTS_KEYSTORE ||
                'examples/asset-publication/keys/deployer.json'
            ),
            'utf8'
          ),
          password
        )
      ).connect(provider)
      const factory = new ContractFactory(
        artifact.abi,
        artifact.bytecode.object,
        wallet
      )
      const gas = await provider.estimateGas({
        ...(await factory.getDeployTransaction()),
        from: wallet.address
      })
      const fee = (await provider.getFeeData()).maxFeePerGas
      if (!fee || (await provider.getBalance(wallet.address)) < gas * fee)
        throw new Error('Insufficient deployment funds')
      console.log(
        `Deploying from ${wallet.address} on OP Sepolia (estimated gas ${gas}).`
      )
      const deployed = await factory.deploy()
      const tx = deployed.deploymentTransaction()
      const address = await deployed.getAddress()
      manifest = {
        chainId: 11155420,
        address,
        transactionHash: tx.hash,
        deployer: wallet.address,
        sourceTreeDirty: !!execFileSync('git', ['status', '--porcelain'], {
          cwd: root,
          encoding: 'utf8'
        }).trim(),
        sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {
          cwd: root,
          encoding: 'utf8'
        }).trim(),
        sourceSha256: hash(
          fs.readFileSync(path.join(dir, 'src/AccessRequests.sol'))
        ),
        abiSha256: hash(fs.readFileSync(path.join(dir, 'abi.json')))
      }
    }
    const { address, transactionHash } = manifest
    const save = () =>
      fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n')
    save()
    console.log(
      `Submitted ${transactionHash}; pending deployment recorded in ${path.relative(
        root,
        manifestFile
      )}.`
    )
    const receipt =
      (await provider.getTransactionReceipt(transactionHash)) ||
      (await provider.waitForTransaction(transactionHash, 1, 180000))
    if (!receipt || receipt.status !== 1)
      throw new Error(
        'Deployment not confirmed; inspect recorded transaction before retrying'
      )
    manifest.deploymentBlock = receipt.blockNumber
    const runtime = await provider.getCode(address)
    manifest.runtimeKeccak256 = keccak256(runtime)
    manifest.runtimeMatchesBuild =
      runtime.toLowerCase() ===
      ('0x' + artifact.deployedBytecode.object.replace(/^0x/, '')).toLowerCase()
    manifest.version = Number(
      await new Contract(address, artifact.abi, provider).VERSION()
    )
    save()
    if (!manifest.runtimeMatchesBuild || manifest.version !== 6)
      throw new Error('Deployment bytecode/version verification failed')
    try {
      run(forge, [
        'verify-contract',
        address,
        'src/AccessRequests.sol:AccessRequests',
        '--chain-id',
        '11155420',
        '--verifier',
        'sourcify',
        '--watch'
      ])
      manifest.sourceVerified = true
    } catch {
      manifest.sourceVerified = false
      console.warn(
        'Deployment succeeded; source verification failed. Retry forge verify-contract with the address in the manifest.'
      )
    }
    save()
    if (args.includes('--configure')) {
      const envFile = path.join(root, '.env')
      const contents = fs.readFileSync(envFile, 'utf8')
      const configs = JSON.parse(
        readEnv(envFile).NEXT_PUBLIC_ACCESS_REQUESTS_CONTRACTS || '{}'
      )
      configs[11155420] = { address, deploymentBlock: receipt.blockNumber }
      const line =
        'NEXT_PUBLIC_ACCESS_REQUESTS_CONTRACTS=' + JSON.stringify(configs)
      fs.writeFileSync(
        envFile,
        /^NEXT_PUBLIC_ACCESS_REQUESTS_CONTRACTS=.*$/m.test(contents)
          ? contents.replace(
              /^NEXT_PUBLIC_ACCESS_REQUESTS_CONTRACTS=.*$/m,
              () => line
            )
          : contents + '\n' + line + '\n'
      )
      run(process.execPath, ['scripts/write-runtime-config.cjs'], root)
      console.log('Updated local .env and runtime configuration.')
    }
    console.log(
      `Deployed version ${manifest.version}: ${address}\nhttps://sepolia-optimism.etherscan.io/tx/${transactionHash}`
    )
  } catch (error) {
    console.error('Deployment stage failed:', error.code || 'local check')
    // RPC and wallet errors can contain credentials: never print their raw objects.
    console.error(
      'Deployment did not finish. Check RPC access, keystore/password, funds, and any saved deployment manifest before retrying.'
    )
    process.exitCode = 1
  } finally {
    provider?.destroy()
  }
}
main()
