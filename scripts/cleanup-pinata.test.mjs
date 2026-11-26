import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cleanup, isAssetFile } from './cleanup-pinata.ts'

const now = Date.parse('2026-11-18T12:00:00Z')
const old = '2026-10-01T00:00:00Z'
const config = {
  jwt: 'test-token',
  gateway: 'https://gateway.example/ipfs',
  deleteUrl: 'https://api.pinata.cloud/pinning/unpin',
  execute: true,
  unpinEnabled: true
}

test('preserves metadata, encrypted DDOs and ambiguous documents', () => {
  for (const value of [
    null,
    [],
    { encryptedData: 'abc' },
    { name: 'metadata' },
    { content: 'abc', filename: 'file', credentialSubject: {} },
    { content: 'abc', filename: '' }
  ])
    assert.equal(isAssetFile(value), false)
  assert.equal(isAssetFile({ content: '', filename: 'empty.txt' }), true)
})

test('snapshots pagination, uses strict age cutoff and only deletes file wrappers', async () => {
  const calls = []
  const rows = [
    { ipfs_pin_hash: 'file', date_pinned: old },
    { ipfs_pin_hash: 'ddo', date_pinned: old },
    { ipfs_pin_hash: 'metadata', date_pinned: old },
    {
      ipfs_pin_hash: 'boundary',
      date_pinned: new Date(now - 30 * 86400000).toISOString()
    },
    { ipfs_pin_hash: 'invalid', date_pinned: 'invalid' }
  ]
  const request = async (input, options) => {
    const url = new URL(input)
    calls.push([url.href, options])
    if (url.pathname === '/data/pinList') {
      assert.equal(options.headers.Authorization, 'Bearer test-token')
      return Response.json({
        count: rows.length,
        rows:
          url.searchParams.get('pageOffset') === '0'
            ? rows.slice(0, 2)
            : rows.slice(2)
      })
    }
    if (options.method === 'DELETE') return new Response(null, { status: 200 })
    assert.equal(options.headers, undefined)
    return Response.json(
      url.pathname.endsWith('/file')
        ? { content: 'data', filename: 'file.csv' }
        : url.pathname.endsWith('/ddo')
        ? { encryptedData: 'xyz' }
        : { name: 'Metadata' }
    )
  }
  await cleanup(config, request, now)
  const deletions = calls.filter(([, options]) => options.method === 'DELETE')
  assert.deepEqual(
    deletions.map(([url]) => url),
    ['https://api.pinata.cloud/pinning/unpin/file']
  )
  assert.equal(
    calls.slice(0, 2).every(([url]) => url.includes('/data/pinList')),
    true
  )
  assert.equal(
    calls.some(
      ([url]) => url.endsWith('/boundary') || url.endsWith('/invalid')
    ),
    false
  )
})

test('dry run never deletes and gateway failures remain pinned with failing status', async () => {
  for (const fails of [false, true]) {
    let deletes = 0
    const request = async (url, options) => {
      if (String(url).includes('/data/pinList'))
        return Response.json({
          count: 1,
          rows: [{ ipfs_pin_hash: 'file', date_pinned: old }]
        })
      if (options.method === 'DELETE') deletes++
      return fails
        ? new Response(null, { status: 503 })
        : Response.json({ content: 'x', filename: 'file' })
    }
    const run = cleanup({ ...config, execute: false }, request, now)
    if (fails) await assert.rejects(run, /incomplete/)
    else await run
    assert.equal(deletes, 0)
  }
})

test('uses public gateway on access denial without sending credentials', async () => {
  const calls = []
  const request = async (url, options) => {
    calls.push(String(url))
    if (String(url).includes('/data/pinList'))
      return Response.json({
        count: 1,
        rows: [{ ipfs_pin_hash: 'ddo', date_pinned: old }]
      })
    assert.equal(options.headers, undefined)
    if (String(url).startsWith('https://gateway.example'))
      return new Response(null, { status: 403 })
    assert.equal(String(url), 'https://gateway.pinata.cloud/ipfs/ddo')
    return Response.json({ encryptedData: 'protected-ddo' })
  }
  await cleanup(config, request, now)
  assert.equal(calls.length, 3)
})
