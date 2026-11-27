const fs = require('node:fs')
const { spawn } = require('node:child_process')
const { processEnv } = require('@next/env')

const [profile, command, ...args] = process.argv.slice(2)
if (!['production', 'local'].includes(profile) || !command) {
  console.error(
    'Usage: node scripts/with-node-env.cjs <production|local> <command> [args...]'
  )
  process.exit(1)
}

// Local settings override shared defaults; production never reads .env.local.
const paths = profile === 'local' ? ['.env.local', '.env'] : ['.env']
const files = paths.map((path) => ({
  path,
  contents: fs.readFileSync(path, 'utf8')
}))
// Next's own loader marks the environment as processed, preventing a subsequent
// automatic load of .env.local from leaking local-only settings into production.
processEnv(files, process.cwd())
process.env.MARKET_ENV_PROFILE = profile
console.log(`Using ${paths.join(' over ')} (${profile} node)`)
const child = spawn(command, args, { stdio: 'inherit', env: process.env })
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal))
}
child.on('error', (error) => {
  console.error(error.message)
  process.exitCode = 1
})
child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0)
})
