import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import { readRequestPage } from '@utils/accessRequests/client'
import { getPublishedAssets, queryMetadata } from '@utils/aquarius'
import AccessRequests from '.'

jest.mock('wagmi', () => ({
  useAccount: jest.fn(),
  useChainId: () => 11155420
}))
jest.mock('@hooks/useEthersSigner', () => ({ useEthersSigner: jest.fn() }))
jest.mock('@utils/wallet', () => ({
  getOrCreateProvider: () => ({ getBlock: async () => ({ timestamp: 50 }) })
}))
jest.mock('@utils/runtimeConfig', () => ({
  getRuntimeConfig: () => ({
    NEXT_PUBLIC_ACCESS_REQUESTS_CONTRACTS: JSON.stringify({
      11155420: {
        address: '0x52908400098527886E0F7030069857D2E4169EE7',
        deploymentBlock: 1
      }
    })
  })
}))
jest.mock('@utils/accessRequests/client', () => ({
  readRequestPage: jest.fn(),
  registryWrite: jest.fn()
}))
jest.mock('@utils/aquarius', () => ({
  getPublishedAssets: jest.fn(() => {
    throw new Error('Metadata unavailable')
  }),
  queryMetadata: jest.fn(() => {
    throw new Error('Metadata unavailable')
  })
}))
jest.mock('@shared/atoms/Tabs', () => ({
  __esModule: true,
  default: ({ items, selectedIndex, onIndexSelected }) => (
    <div>
      {items.map((item, index) => (
        <button key={item.title} onClick={() => onIndexSelected(index)}>
          {item.title}
        </button>
      ))}
      {items[selectedIndex].content}
    </div>
  )
}))
jest.mock('./RequestTable', () => ({
  __esModule: true,
  default: ({ requests, loading }) => (
    <div>
      {loading ? 'Loading requests' : `${requests.length} requests`}
      {requests.map((r) => (
        <span key={r.id}>Request {r.id.toString()}</span>
      ))}
    </div>
  )
}))

const receiver = '0x94549951623DD6c3265DBbB1b032d6cF48Ba7811'
let client: QueryClient
beforeEach(() => {
  jest.clearAllMocks()
  ;(useAccount as jest.Mock).mockReturnValue({ address: receiver })
  client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } })
})
afterEach(() => client.clear())
const page = (ids: number[], next?: string) => ({
  requests: ids.map((id) => ({ id: BigInt(id), receiver })),
  now: 50n,
  next
})
const view = () => (
  <QueryClientProvider client={client}>
    <AccessRequests />
  </QueryClientProvider>
)

it('loads the wallet inbox across pages even when metadata is unavailable', async () => {
  ;(readRequestPage as jest.Mock).mockImplementation(
    async (_, scope, wallet, offset) => {
      expect(scope).toBe('receiver')
      expect(wallet).toBe(receiver)
      return offset === '0' ? page([1], '50') : page([51])
    }
  )
  render(view())
  expect(await screen.findByText('2 requests')).toBeVisible()
  expect(screen.getByText('Request 1')).toBeVisible()
  expect(screen.getByText('Request 51')).toBeVisible()
  expect(getPublishedAssets).not.toHaveBeenCalled()
  expect(queryMetadata).not.toHaveBeenCalled()
  expect(screen.queryByText(/Could not load/)).not.toBeInTheDocument()
})

it('treats an empty on-chain inbox as a successful empty result', async () => {
  ;(readRequestPage as jest.Mock).mockResolvedValue(page([]))
  render(view())
  expect(await screen.findByText('0 requests')).toBeVisible()
  expect(screen.queryByText(/Could not load/)).not.toBeInTheDocument()
})

it('retains loaded rows on an RPC page failure and retries the failed page', async () => {
  let failed = true
  ;(readRequestPage as jest.Mock).mockImplementation(
    async (_, scope, wallet, offset) => {
      if (offset === '0') return page([1], '50')
      if (failed) throw new Error('RPC unavailable')
      return page([51])
    }
  )
  render(view())
  expect(await screen.findByText(/Could not load all received/)).toBeVisible()
  expect(screen.getByText('Request 1')).toBeVisible()
  failed = false
  fireEvent.click(screen.getByRole('button', { name: 'Refresh requests' }))
  expect(await screen.findByText('2 requests')).toBeVisible()
  expect(screen.queryByText(/Could not load/)).not.toBeInTheDocument()
})

it('switches inboxes with the connected wallet and uses the sender index for Sent', async () => {
  ;(readRequestPage as jest.Mock).mockImplementation(async (_, scope, wallet) =>
    page([wallet === receiver ? 1 : 2])
  )
  const { rerender } = render(view())
  expect(await screen.findByText('Request 1')).toBeVisible()
  ;(useAccount as jest.Mock).mockReturnValue({ address: 'another-wallet' })
  rerender(view())
  expect(await screen.findByText('Request 2')).toBeVisible()
  expect(screen.queryByText('Request 1')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Sent' }))
  await waitFor(() =>
    expect(readRequestPage).toHaveBeenCalledWith(
      expect.anything(),
      'requester',
      'another-wallet',
      '0',
      expect.anything()
    )
  )
})
