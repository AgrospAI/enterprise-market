// Run from any directory against an isolated Anvil fork; never a public RPC.
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
const root = fileURLToPath(new URL('../../../', import.meta.url))
const { JsonRpcProvider, Contract, ContractFactory, ZeroAddress, keccak256 } =
  await import(root + '/node_modules/ethers/lib.esm/index.js')
const provider = new JsonRpcProvider('http://127.0.0.1:18546')
provider.pollingInterval = 100
const dir = root + '/contracts/access-requests'
try {
  assert.match(
    await provider.send('web3_clientVersion', []),
    /anvil/i,
    'Requires an isolated Anvil fork'
  )
  assert.equal((await provider.getNetwork()).chainId, 11155420n)
  const owner = await provider.getSigner(0),
    requester = await provider.getSigner(1),
    third = await provider.getSigner(2)
  const artifact = JSON.parse(
    fs.readFileSync(dir + '/out/AccessRequests.t.sol/MockNft.json')
  )
  const factory = new ContractFactory(
    artifact.abi,
    artifact.bytecode.object,
    owner
  )
  const dataset = await factory.deploy(await owner.getAddress())
  await dataset.waitForDeployment()
  const algorithm = await factory.deploy(await third.getAddress())
  await algorithm.waitForDeployment()
  const registryArtifact = JSON.parse(
    fs.readFileSync(dir + '/out/AccessRequests.sol/AccessRequests.json')
  )
  const deployed = await new ContractFactory(
    registryArtifact.abi,
    registryArtifact.bytecode.object,
    owner
  ).deploy()
  await deployed.waitForDeployment()
  const registry = deployed.connect(requester)
  assert.equal(await registry.VERSION(), 6n)
  await (await dataset.authorize(await registry.getAddress())).wait()
  const metadata = [
    0,
    'https://node.example',
    '',
    '0x02',
    '0x1234',
    keccak256('0x1234')
  ]
  const ds = await dataset.getAddress(),
    al = await algorithm.getAddress()
  for (const kind of [0, 1, 2]) {
    const args = [
      ds,
      'compute-' + kind,
      kind,
      kind === 0 ? al : ZeroAddress,
      kind === 0 ? 'algorithm-service' : '',
      kind === 1 ? await third.getAddress() : ZeroAddress,
      await owner.getAddress(),
      ''
    ]
    await assert.rejects(
      registry.connect(owner).createRequest.staticCall(...args)
    )
    await (await registry.createRequest(...args)).wait()
    const id = await registry.requestCount()
    await assert.rejects(registry.createRequest.staticCall(...args))
    await assert.rejects(
      registry.connect(third).approve.staticCall(id, metadata)
    )
    await assert.rejects(registry.connect(owner).cancel.staticCall(id))
    await (await registry.connect(owner).approve(id, metadata)).wait()
    const row = await registry.getRequest(id)
    assert.equal(row.status, 1n)
    assert.equal(await dataset.metadataHash(), metadata[5])
    assert.equal(row.decidedBy, await owner.getAddress())
    assert.equal(row.expiresAt - row.createdAt, 604800n)
    await assert.rejects(registry.cancel.staticCall(id))
  }
  await (
    await registry.createRequest(
      ds,
      'rejection',
      0,
      al,
      'algorithm-service',
      ZeroAddress,
      await owner.getAddress(),
      ''
    )
  ).wait()
  await (
    await registry.connect(owner).reject(await registry.requestCount())
  ).wait()
  assert.equal((await registry.getRequest(4)).status, 2n)
  await (
    await registry.createRequest(
      ds,
      'cancellation',
      2,
      ZeroAddress,
      '',
      ZeroAddress,
      await owner.getAddress(),
      ''
    )
  ).wait()
  await (await registry.cancel(await registry.requestCount())).wait()
  assert.equal((await registry.getRequest(5)).status, 3n)
  await (
    await registry.createRequest(
      ds,
      'expiry',
      0,
      al,
      'algorithm-service',
      ZeroAddress,
      await owner.getAddress(),
      ''
    )
  ).wait()
  await provider.send('evm_increaseTime', [604800])
  await provider.send('evm_mine', [])
  await assert.rejects(registry.connect(owner).approve.staticCall(6, metadata))
  await (await registry.cancel(6)).wait()
  assert.equal(await registry.requesterCount(await requester.getAddress()), 6n)
  assert.equal(await registry.datasetCount(ds), 6n)
  assert.equal(await registry.receiverCount(await owner.getAddress()), 6n)
  assert.equal(
    (await registry.receiverPage(await owner.getAddress(), 3, 50)).length,
    3
  )
  assert.equal(
    (await registry.requesterPage(await requester.getAddress(), 0, 3)).length,
    3
  )
  assert.equal((await registry.datasetPage(ds, 3, 50)).length, 3)
  await assert.rejects(registry.datasetPage(ds, 0, 51))
  console.log(
    'PASS: v6 registry deployed only on a local fork; all 3 permissions, approval/rejection/cancellation, unauthorized/self-invalid actions, duplicates, expiry, terminal states and pagination. Public registry unchanged.'
  )
  const evidence = {
    network: 'local fork of OP Sepolia',
    registry: await registry.getAddress(),
    result: 'passed',
    checkedAt: new Date().toISOString(),
    checks: [
      'fresh local v6 deployment',
      'atomic metadata updates',
      'all three permission kinds',
      'create',
      'approve',
      'reject',
      'cancel',
      'unauthorized decisions blocked',
      'duplicates blocked',
      'seven-day expiry',
      'terminal states immutable',
      'bounded requester/dataset pagination'
    ],
    publicTransactionsSubmitted: 0
  }
  fs.writeFileSync(
    dir + '/fork-smoke.v6.op-sepolia.json',
    JSON.stringify(evidence, null, 2) + '\n'
  )
} catch (e) {
  console.error(e.shortMessage || e.message)
  process.exitCode = 1
} finally {
  provider.destroy()
}
