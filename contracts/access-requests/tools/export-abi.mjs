import fs from 'node:fs'
import crypto from 'node:crypto'
const artifact = JSON.parse(
  fs.readFileSync(
    new URL('../out/AccessRequests.sol/AccessRequests.json', import.meta.url)
  )
)
const abi = artifact.abi
const json = JSON.stringify(abi, null, 2) + '\n'
fs.writeFileSync(new URL('../abi.json', import.meta.url), json)
fs.writeFileSync(
  new URL('../../../src/@utils/accessRequests/abi.ts', import.meta.url),
  "// Generated from the pinned registry build; do not edit.\nimport abi from '../../../contracts/access-requests/abi.json'\nexport const accessRequestsAbi = abi\n"
)
console.log(
  'ABI SHA-256:',
  crypto.createHash('sha256').update(json).digest('hex')
)
