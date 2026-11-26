import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import RequestAssetCell from './RequestAssetCell'
import { queryMetadata, getAsset } from '@utils/aquarius'
import { copyTextToClipboard } from '@utils/clipboard'
import { Asset } from 'src/@types/Asset'

jest.mock('@utils/aquarius', () => ({
  queryMetadata: jest.fn(),
  getAsset: jest.fn(),
  generateBaseQuery: (query: unknown) => query,
  getFilterTerm: (field: string, value: string) => ({ [field]: value })
}))
jest.mock('@utils/clipboard', () => ({ copyTextToClipboard: jest.fn() }))
jest.mock('@shared/ExplorerLink', () => ({
  __esModule: true,
  default: ({
    children,
    path
  }: {
    children: React.ReactNode
    path: string
  }) => <a href={`https://explorer.example/${path}`}>{children}</a>
}))

const nft = '0x1234567890123456789012345678901234567890'
const serviceId = 'abcdef123456789012345678901234567890abcdef'
const asset = {
  id: 'did:op:dataset',
  credentialSubject: {
    nftAddress: nft,
    chainId: 11155420,
    metadata: { name: 'Red wine quality', type: 'dataset' },
    services: [{ id: serviceId, name: 'Quality analysis' }]
  }
} as Asset

function mount(knownAsset?: Asset) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  return render(
    <QueryClientProvider client={client}>
      <RequestAssetCell
        chainId={11155420}
        nft={nft}
        type="Dataset"
        knownAsset={knownAsset}
      />
    </QueryClientProvider>
  )
}

beforeEach(() => jest.clearAllMocks())

it('shows only the linked title and DID and copies the complete DID', async () => {
  ;(copyTextToClipboard as jest.Mock).mockResolvedValue(true)
  mount(asset)
  expect(
    screen.getByRole('link', { name: 'Red wine quality' })
  ).toHaveAttribute('href', '/asset/did:op:dataset')
  expect(screen.getByRole('link', { name: /did:op:d/ })).toHaveAttribute(
    'href',
    '/asset/did:op:dataset'
  )
  expect(screen.queryByText('Quality analysis')).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Copy NFT' })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Copy Service' })
  ).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Copy DID' }))
  await waitFor(() =>
    expect(copyTextToClipboard).toHaveBeenCalledWith(asset.id)
  )
  expect(queryMetadata).not.toHaveBeenCalled()
})

it('resolves sent request names by network and NFT address', async () => {
  ;(queryMetadata as jest.Mock).mockResolvedValue({ results: [asset] })
  mount()
  expect(
    await screen.findByRole('link', { name: 'Red wine quality' })
  ).toHaveAttribute('href', '/asset/did:op:dataset')
  expect(queryMetadata).toHaveBeenCalledWith(
    expect.objectContaining({
      chainIds: [11155420],
      filters: [
        {
          term: {
            'credentialSubject.nftAddress': {
              value: nft.toLowerCase(),
              case_insensitive: true
            }
          }
        }
      ]
    }),
    expect.anything()
  )
})

it('does not display an invented DID for ambiguous metadata', async () => {
  ;(queryMetadata as jest.Mock).mockResolvedValue({ results: [asset, asset] })
  mount()
  expect(
    await screen.findByText(
      'Dataset metadata unavailable',
      {},
      { timeout: 3000 }
    )
  ).toBeVisible()
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

it('resolves algorithm DIDs to names and keeps portal links while loading', async () => {
  ;(getAsset as jest.Mock).mockResolvedValue(asset)
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  render(
    <QueryClientProvider client={client}>
      <RequestAssetCell chainId={11155420} did={asset.id} type="Algorithm" />
    </QueryClientProvider>
  )
  expect(
    await screen.findByRole('link', { name: 'Red wine quality' })
  ).toHaveAttribute('href', `/asset/${asset.id}`)
  expect(getAsset).toHaveBeenCalledWith(asset.id, expect.anything())
})
