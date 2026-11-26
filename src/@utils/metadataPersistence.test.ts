/* eslint-disable testing-library/await-async-utils -- wait is an ethers transaction method. */
import { Nft } from '@oceanprotocol/lib'
import { signAssetAndUploadToIpfs } from '@components/Publish/_utils'
import { cloneDdo, persistDdo, waitForReceipt } from './metadataPersistence'
import { Asset } from 'src/@types/Asset'
import { Signer, TransactionResponse } from 'ethers'

jest.mock('@oceanprotocol/lib', () => ({ Nft: jest.fn() }))
jest.mock('@components/Publish/_utils', () => ({
  signAssetAndUploadToIpfs: jest.fn(),
  stringifyCredentialPolicies: jest.fn()
}))
const asset = {
  id: 'did:op:test',
  indexedMetadata: { nft: { state: 0 }, event: { txid: 'old' } },
  views: 1,
  accessDetails: [],
  credentialSubject: {
    nftAddress: '0x1234',
    chainId: 11155420,
    metadata: { name: 'Original' },
    services: [
      { id: 'first', serviceEndpoint: 'https://wrong.example' },
      { id: 'selected', serviceEndpoint: 'https://node.example' }
    ],
    credentials: { deny: ['keep'] },
    stats: ['exclude']
  }
} as unknown as Asset
const tx = { hash: '0xtx', wait: jest.fn() }
const signer = {
  provider: { getNetwork: jest.fn().mockResolvedValue({ chainId: 11155420n }) },
  getAddress: jest.fn().mockResolvedValue('0xowner'),
  sendTransaction: jest.fn().mockResolvedValue(tx)
} as unknown as Signer
const setMetadataTx = jest.fn().mockResolvedValue({ to: '0x1234' })
const options = {
  asset,
  signer,
  ssiWalletContext: {} as Parameters<typeof signAssetAndUploadToIpfs>[4],
  serviceId: 'selected'
}
beforeEach(() => {
  jest.clearAllMocks()
  ;(Nft as jest.Mock).mockImplementation(() => ({ setMetadataTx }))
  ;(signAssetAndUploadToIpfs as jest.Mock).mockResolvedValue({
    flags: 2,
    metadataIPFS: '0xdata',
    metadataIPFSHash: '0xhash'
  })
  tx.wait.mockResolvedValue({ status: 1, hash: tx.hash })
})
it('serializes a deep copy and strips indexed/UI fields', () => {
  const copy = cloneDdo(asset)
  expect(copy.indexedMetadata).toBeUndefined()
  expect(copy.credentialSubject).not.toHaveProperty('stats')
  copy.credentialSubject.metadata.name = 'Changed'
  expect(asset.credentialSubject.metadata.name).toBe('Original')
})
it('uses only the affected node and reports success after a successful receipt', async () => {
  const submitted = jest.fn()
  const snapshot = JSON.stringify(asset)
  await persistDdo({ ...options, onSubmitted: submitted })
  expect(signAssetAndUploadToIpfs).toHaveBeenCalledWith(
    expect.anything(),
    signer,
    expect.anything(),
    'https://node.example',
    options.ssiWalletContext
  )
  expect(setMetadataTx).toHaveBeenCalledWith(
    '0x1234',
    '0xowner',
    0,
    'https://node.example',
    '',
    '0x02',
    '0xdata',
    '0xhash'
  )
  expect(submitted).toHaveBeenCalledWith(tx.hash)
  expect(tx.wait).toHaveBeenCalledWith(1, 180000)
  expect(JSON.stringify(asset)).toBe(snapshot)
})
it.each(['Invalid SSI session', 'Encryption failed', 'Upload failed'])(
  'stops before the metadata transaction on %s',
  async (error) => {
    ;(signAssetAndUploadToIpfs as jest.Mock).mockRejectedValue(new Error(error))
    await expect(persistDdo(options)).rejects.toThrow(error)
    expect(setMetadataTx).not.toHaveBeenCalled()
    expect(signer.sendTransaction).not.toHaveBeenCalled()
  }
)
it('rechecks metadata after signing and before submitting', async () => {
  const check = jest
    .fn()
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error('Version changed'))
  await expect(
    persistDdo({ ...options, beforeSigning: check })
  ).rejects.toThrow('Version changed')
  expect(signer.sendTransaction).not.toHaveBeenCalled()
})
it('rejects reverted receipts', async () => {
  tx.wait.mockResolvedValue({ status: 0 })
  await expect(
    waitForReceipt(tx as unknown as TransactionResponse)
  ).rejects.toThrow('did not succeed')
})
it('accepts a successful repriced replacement receipt', async () => {
  const receipt = { status: 1, hash: '0xreplacement' }
  tx.wait.mockRejectedValue({
    code: 'TRANSACTION_REPLACED',
    cancelled: false,
    receipt
  })
  await expect(
    waitForReceipt(tx as unknown as TransactionResponse)
  ).resolves.toEqual(receipt)
})
it('does not report a cancelled replacement as success', async () => {
  tx.wait.mockRejectedValue({
    code: 'TRANSACTION_REPLACED',
    cancelled: true,
    receipt: { status: 1 }
  })
  await expect(
    waitForReceipt(tx as unknown as TransactionResponse)
  ).rejects.toMatchObject({ cancelled: true })
})
it('does not report missing or timed out receipts as success', async () => {
  tx.wait.mockResolvedValue(null)
  await expect(
    waitForReceipt(tx as unknown as TransactionResponse)
  ).rejects.toThrow('did not succeed')
  tx.wait.mockRejectedValue(new Error('timeout'))
  await expect(
    waitForReceipt(tx as unknown as TransactionResponse)
  ).rejects.toThrow('timeout')
})

it('submits the combined transaction instead of a separate NFT metadata transaction', async () => {
  const buildTransaction = jest
    .fn()
    .mockResolvedValue({ to: 'registry', data: 'combined' })
  await persistDdo({ ...options, buildTransaction })
  expect(buildTransaction).toHaveBeenCalledWith({
    state: 0,
    decryptorUrl: 'https://node.example',
    decryptorAddress: '',
    flags: '0x02',
    data: '0xdata',
    metadataHash: '0xhash'
  })
  expect(setMetadataTx).not.toHaveBeenCalled()
  expect(signer.sendTransaction).toHaveBeenCalledTimes(1)
  expect(signer.sendTransaction).toHaveBeenCalledWith({
    to: 'registry',
    data: 'combined'
  })
})
