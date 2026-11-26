import {
  AbiCoder,
  getBytes,
  keccak256,
  toUtf8Bytes,
  verifyMessage,
  Wallet
} from 'ethers'
import { cloneServiceFiles, prepareFileClone } from './files'
import { Asset } from 'src/@types/Asset'
import { Service } from 'src/@types/ddo/Service'
const source = {
  id: 'source',
  files: '0x1234',
  serviceEndpoint: 'https://node.example'
} as Service
const asset = {
  id: 'did:ope:asset',
  credentialSubject: { chainId: 11155420 }
} as Asset
const wallet = new Wallet('0x' + '11'.repeat(32))
const token = '0x3333333333333333333333333333333333333333'
const mockFetch = jest.fn()
const originalFetch = global.fetch
beforeEach(() => {
  mockFetch.mockReset()
  global.fetch = mockFetch
})
afterAll(() => {
  global.fetch = originalFetch
})
const response = (value: string) => ({ ok: true, text: async () => value })
it('checks the node capability before any token provisioning', async () => {
  mockFetch
    .mockResolvedValueOnce(
      response('{"supported":true,"protocol":"cloneServiceFiles-v1"}')
    )
    .mockResolvedValueOnce(response('{"id":"peer"}'))
  await expect(prepareFileClone(source)).resolves.toBe('peer')
  expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
    command: 'cloneServiceFiles',
    probe: true
  })
})
it('signs a node-bound request and accepts only ciphertext', async () => {
  mockFetch
    .mockResolvedValueOnce(response('10'))
    .mockResolvedValueOnce(response('0xabcd'))
  await expect(
    cloneServiceFiles(asset, source, token, wallet, 'peer')
  ).resolves.toBe('0xabcd')
  const task = JSON.parse(mockFetch.mock.calls[1][1].body)
  expect(task.nonce).toBe('11')
  expect(task.sourceFilesHash).toBe(keccak256(source.files))
  const domain = `cloneServiceFiles:${keccak256(
    AbiCoder.defaultAbiCoder().encode(
      [
        'string',
        'uint256',
        'string',
        'string',
        'address',
        'bytes32',
        'uint256'
      ],
      [
        'peer',
        task.chainId,
        task.documentId,
        task.serviceId,
        task.datatokenAddress,
        task.sourceFilesHash,
        task.validUntil
      ]
    )
  )}`
  expect(
    verifyMessage(
      getBytes(keccak256(toUtf8Bytes(wallet.address + task.nonce + domain))),
      task.signature
    )
  ).toBe(wallet.address)
  expect(task.datatokenAddress).toBe(token)
  expect(task.files).toBeUndefined()
})
it('refuses nodes without cloning support', async () => {
  mockFetch.mockResolvedValue(response('{}'))
  await expect(prepareFileClone(source)).rejects.toThrow('does not support')
})
it('does not publish a node error as encrypted file data', async () => {
  mockFetch
    .mockResolvedValueOnce(response('10'))
    .mockResolvedValueOnce({ ok: false, status: 403 })
  await expect(
    cloneServiceFiles(asset, source, token, wallet, 'peer')
  ).rejects.toThrow('403')
})
