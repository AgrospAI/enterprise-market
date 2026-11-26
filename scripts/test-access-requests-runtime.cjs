// Tests the local writer in isolation, without reading a developer's .env.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const vm = require('node:vm')
const { execFileSync } = require('node:child_process')
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'access-requests-runtime-'))
try {
  fs.mkdirSync(path.join(root, 'public'))
  const relay = JSON.stringify({ 11155420: 'https://relay.example.test' })
  const registry = JSON.stringify({
    11155420: {
      address: '0x52908400098527886E0F7030069857D2E4169EE7',
      deploymentBlock: 1
    }
  })
  execFileSync(
    process.execPath,
    [path.join(__dirname, 'write-runtime-config.cjs')],
    {
      cwd: root,
      env: {
        ...process.env,
        NEXT_PUBLIC_TRANSACTION_RELAY_MAP: relay,
        NEXT_PUBLIC_ACCESS_REQUESTS_CONTRACTS: registry,
        NEXT_PUBLIC_AUTH_ENABLED: 'false'
      }
    }
  )
  const sandbox = { window: {} }
  vm.runInNewContext(
    fs.readFileSync(path.join(root, 'public/runtime-config.js'), 'utf8'),
    sandbox
  )
  assert.equal(
    sandbox.window.__RUNTIME_CONFIG__.NEXT_PUBLIC_TRANSACTION_RELAY_MAP,
    relay
  )
  assert.equal(
    sandbox.window.__RUNTIME_CONFIG__.NEXT_PUBLIC_ACCESS_REQUESTS_CONTRACTS,
    registry
  )
  console.log('PASS: local writer preserves relay and registry JSON.')
} finally {
  fs.rmSync(root, { recursive: true, force: true })
}
