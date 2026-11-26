import fs from 'node:fs'
import assert from 'node:assert/strict'
import {
  JsonRpcProvider,
  Contract,
  ContractFactory,
  ZeroAddress,
  keccak256
} from 'ethers'
const provider = new JsonRpcProvider(
  process.env.LOCAL_RPC_URL || 'http://127.0.0.1:18545'
)
assert.equal((await provider.getNetwork()).chainId, 31337n)
const owner = await provider.getSigner(0)
const requester = await provider.getSigner(1)
const third = await provider.getSigner(2)
const artifact = JSON.parse(
  fs.readFileSync('out/AccessRequests.t.sol/MockNft.json')
)
const factory = new ContractFactory(
  artifact.abi,
  artifact.bytecode.object,
  owner
)
const dataset = await factory.deploy(await owner.getAddress())
const algorithm = await factory.deploy(await third.getAddress())
await dataset.waitForDeployment()
await algorithm.waitForDeployment()
const registryArtifact = JSON.parse(
  fs.readFileSync('out/AccessRequests.sol/AccessRequests.json')
)
const deployed = await new ContractFactory(
  registryArtifact.abi,
  registryArtifact.bytecode.object,
  owner
).deploy()
await deployed.waitForDeployment()
const registry = deployed.connect(requester)
await (await dataset.authorize(await registry.getAddress())).wait()
const metadata = [
  0,
  'https://node.example',
  '',
  '0x02',
  '0x1234',
  keccak256('0x1234')
]
await (
  await registry.createRequest(
    await dataset.getAddress(),
    'dataset-service',
    0,
    await algorithm.getAddress(),
    'algorithm-service',
    ZeroAddress,
    await owner.getAddress(),
    ''
  )
).wait()
await assert.rejects(registry.connect(third).approve(1, metadata))
await (await registry.connect(owner).approve(1, metadata)).wait()
assert.equal((await registry.getRequest(1)).status, 1n)
assert.equal(await dataset.metadataHash(), metadata[5])
await (
  await registry.createRequest(
    await dataset.getAddress(),
    'network-service',
    2,
    ZeroAddress,
    '',
    ZeroAddress,
    await owner.getAddress(),
    ''
  )
).wait()
await (await registry.cancel(2)).wait()
assert.equal(
  (await registry.requesterPage(await requester.getAddress(), 0, 50)).length,
  2
)
assert.equal(
  (await registry.datasetPage(await dataset.getAddress(), 1, 50))[0].status,
  3n
)
assert.equal(await registry.VERSION(), 6n)
assert.equal(await registry.receiverCount(await owner.getAddress()), 2n)
assert.equal(
  (await registry.receiverPage(await owner.getAddress(), 0, 50))[0].receiver,
  await owner.getAddress()
)
console.log(
  'PASS: fresh v6 local deployment, atomic metadata approval, separate owner/requester/unauthorized wallets, create/approve/cancel/pagination.'
)
provider.destroy()
