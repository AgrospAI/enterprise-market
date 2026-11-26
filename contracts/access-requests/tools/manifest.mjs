// Run after broadcast and source verification, from this directory.
import fs from 'node:fs'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
const broadcast = JSON.parse(
  fs.readFileSync(
    process.argv[2] || 'broadcast/Deploy.s.sol/11155420/run-latest.json'
  )
)
const tx = broadcast.transactions.find(
  (tx) =>
    tx.contractName === 'AccessRequests' && tx.transactionType === 'CREATE'
)
const receipt = broadcast.receipts.find((r) => r.transactionHash === tx?.hash)
if (
  !tx?.contractAddress ||
  !receipt ||
  Number(receipt.status) !== 1 ||
  ![11155420, 31337].includes(Number(broadcast.chain))
)
  throw new Error('No successful supported-chain deployment receipt found')
const abi = fs.readFileSync('abi.json')
const manifest = {
  chainId: Number(broadcast.chain),
  address: tx.contractAddress,
  deploymentBlock: Number(receipt.blockNumber),
  transactionHash: receipt.transactionHash,
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8'
  }).trim(),
  sourceTreeDirty: !!execFileSync('git', ['status', '--porcelain'], {
    encoding: 'utf8'
  }).trim(),
  compiler: '0.8.24',
  evmVersion: 'paris',
  optimizer: { enabled: true, runs: 200 },
  viaIR: true,
  bytecodeHash: 'none',
  dependencies: { '@openzeppelin/contracts': '5.0.2' },
  abiSha256: crypto.createHash('sha256').update(abi).digest('hex')
}
fs.writeFileSync(
  process.argv[3] || 'deployment.local.json',
  JSON.stringify(manifest, null, 2) + '\n'
)
console.log('Deployment manifest written; no RPC credentials included.')
