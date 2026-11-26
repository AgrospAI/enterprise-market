import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useQuery } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import {
  nftOwner,
  readRequest,
  authorizeMetadata
} from '@utils/accessRequests/client'
import RequestDialog from './RequestDialog'
import {
  activateRequest,
  observePermission,
  reviewActivation
} from '@utils/accessRequests/activate'
import { AccessRequest } from 'src/@types/AccessRequest'

jest.mock('@utils/wallet/jsonWalletConnector', () => ({
  JSON_WALLET_CONNECTOR_ID: 'jsonWallet'
}))

let mockDebug = false
jest.mock('@context/UserPreferences', () => ({
  useUserPreferences: () => ({ debug: mockDebug })
}))
jest.mock('@context/MarketMetadata', () => ({
  useMarketMetadata: () => ({ approvedBaseTokens: [] })
}))
const mockMutate = jest.fn().mockResolvedValue(undefined)
jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
  useQueryClient: () => ({ invalidateQueries: jest.fn() })
}))
jest.mock('wagmi', () => ({
  useAccount: jest.fn(),
  useChainId: () => 11155420
}))
jest.mock('@hooks/useEthersSigner', () => ({ useEthersSigner: () => ({}) }))
jest.mock('@hooks/useAccessRequests', () => ({
  useRegistryMutation: () => ({ mutateAsync: mockMutate }),
  useChainTime: () => ({ data: 50n }),
  accessRequestKey: () => ['accessRequests']
}))
jest.mock('@context/Asset', () => ({ useAsset: () => undefined }))
jest.mock('@context/SsiWallet', () => ({ useSsiWallet: () => ({}) }))
jest.mock('@context/PontusXIdentity', () => ({
  usePontusXLegalName: () => undefined
}))
jest.mock('@utils/accessRequests/client', () => ({
  sameAddress: (a, b) => !!a && !!b && a.toLowerCase() === b.toLowerCase(),
  readRequest: jest.fn(),
  nftOwner: jest.fn(),
  authorizeMetadata: jest.fn()
}))
jest.mock('@utils/accessRequests/activate', () => ({
  reviewActivation: jest.fn(),
  activateRequest: jest.fn(),
  observePermission: jest.fn(),
  ReviewChangedError: class MockReviewChangedError extends Error {}
}))
jest.mock('@utils/accessRequests/transactions', () => ({
  submittedActivation: () => undefined,
  rememberActivation: jest.fn()
}))
jest.mock('@shared/atoms/Modal', () => ({
  __esModule: true,
  default: ({ children }) => <div role="dialog">{children}</div>
}))
jest.mock('@shared/atoms/Copy', () => () => null)
jest.mock('@shared/Web3Feedback', () => () => null)
jest.mock('@shared/ExplorerLink', () => () => null)
jest.mock('./RequestAssetCell', () => ({
  __esModule: true,
  default: () => <span>Test asset</span>
}))

const request = {
  id: 1n,
  requester: 'requester',
  receiver: 'receiver',
  datasetNft: 'nft',
  datasetServiceId: 'service',
  createdAt: 1n,
  expiresAt: 100n,
  status: 0,
  decidedAt: 0n,
  decidedBy: ''
} as AccessRequest
const config = { chainId: 11155420, address: 'registry', deploymentBlock: 1 }
const mockRefetch = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  mockDebug = false
  ;(useAccount as jest.Mock).mockReturnValue({ address: 'receiver' })
  ;(readRequest as jest.Mock).mockResolvedValue(request)
  ;(nftOwner as jest.Mock).mockResolvedValue('receiver')
  ;(useQuery as jest.Mock).mockImplementation(({ queryKey }) =>
    queryKey.includes('datasetOwner')
      ? { data: 'receiver' }
      : { isError: true, refetch: mockRefetch }
  )
})

it('can reject using on-chain authority while metadata verification is unavailable', async () => {
  render(
    <RequestDialog config={config} request={request} onClose={jest.fn()} />
  )
  expect(screen.getByRole('button', { name: 'Accept request' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Reject request' }))
  await waitFor(() =>
    expect(mockMutate).toHaveBeenCalledWith({
      action: 'reject',
      args: [1n],
      onSubmitted: expect.any(Function)
    })
  )
  expect(nftOwner).toHaveBeenCalledWith(config.chainId, 'nft')
})
it('rechecks ownership before rejection if it changed after rendering', async () => {
  ;(nftOwner as jest.Mock).mockResolvedValue('new-owner')
  render(
    <RequestDialog config={config} request={request} onClose={jest.fn()} />
  )
  fireEvent.click(screen.getByRole('button', { name: 'Reject request' }))
  expect(
    await screen.findByText(/decision could not be confirmed/)
  ).toBeVisible()
  expect(mockMutate).not.toHaveBeenCalled()
})
it('does not offer decisions to a new owner who was not the recorded receiver', () => {
  ;(useAccount as jest.Mock).mockReturnValue({ address: 'new-owner' })
  ;(useQuery as jest.Mock).mockImplementation(({ queryKey }) =>
    queryKey.includes('datasetOwner')
      ? { data: 'new-owner' }
      : { isError: true }
  )
  render(
    <RequestDialog config={config} request={request} onClose={jest.fn()} />
  )
  expect(screen.getByText(/Dataset ownership changed/)).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Reject request' })
  ).not.toBeInTheDocument()
})

const terms = {
  name: 'Private analysis',
  price: '0',
  timeout: 604800,
  baseToken: '0x1111111111111111111111111111111111111111',
  compute: {
    allowRawAlgorithm: false,
    allowNetworkAccess: true,
    publisherTrustedAlgorithms: [],
    publisherTrustedAlgorithmPublishers: []
  }
}
const serviceRequest = {
  ...request,
  serviceTerms: JSON.stringify(terms)
}
const reviewData = {
  request: serviceRequest,
  owner: 'receiver',
  fingerprint: 'reviewed',
  metadataAuthorized: false,
  terms,
  dataset: { id: 'did:op:asset' },
  patch: { active: false, before: {}, after: {} }
}
function verifiedReview(data = reviewData) {
  ;(useQuery as jest.Mock).mockImplementation(({ queryKey }) => {
    if (queryKey.includes('datasetOwner')) return { data: 'receiver' }
    if (queryKey.includes('record'))
      return { data: serviceRequest, refetch: mockRefetch }
    return { data, refetch: mockRefetch }
  })
  ;(reviewActivation as jest.Mock).mockResolvedValue(data)
  ;(authorizeMetadata as jest.Mock).mockResolvedValue({})
  ;(activateRequest as jest.Mock).mockResolvedValue({})
  ;(observePermission as jest.Mock).mockResolvedValue(true)
}
it('shares settings and hides receiver, technical details and the separate authorization action', () => {
  verifiedReview()
  render(
    <RequestDialog
      config={config}
      request={serviceRequest}
      direction="received"
      onClose={jest.fn()}
    />
  )
  expect(screen.getByText('Requester', { exact: true })).toBeVisible()
  expect(
    screen.queryByText('Receiver', { exact: true })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByText('New service', { exact: true })
  ).not.toBeInTheDocument()
  expect(screen.queryByText('View new service details')).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Authorize consent updates' })
  ).not.toBeInTheDocument()
  expect(screen.getByText('Free access')).toBeVisible()
  expect(screen.getByText('7 days')).toBeVisible()
})
it('shows technical changes only in debug mode', () => {
  mockDebug = true
  verifiedReview()
  render(
    <RequestDialog
      config={config}
      request={serviceRequest}
      onClose={jest.fn()}
    />
  )
  expect(screen.getByText('View new service details')).toBeVisible()
})
it('authorizes and accepts in one flow while preserving the reviewed fingerprint', async () => {
  verifiedReview()
  render(
    <RequestDialog
      config={config}
      request={serviceRequest}
      onClose={jest.fn()}
    />
  )
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'Accept request' }))
  await waitFor(() => expect(activateRequest).toHaveBeenCalled())
  expect(authorizeMetadata).toHaveBeenCalledWith(
    config,
    'nft',
    expect.anything(),
    'receiver',
    expect.any(Function)
  )
  expect(
    (authorizeMetadata as jest.Mock).mock.invocationCallOrder[0]
  ).toBeLessThan((activateRequest as jest.Mock).mock.invocationCallOrder[0])
  expect((activateRequest as jest.Mock).mock.calls[0][1]).toBe(reviewData)
  await screen.findByText('New service created.')
})
it('does not authorize or accept settings that changed since review', async () => {
  verifiedReview()
  ;(reviewActivation as jest.Mock).mockResolvedValue({
    ...reviewData,
    fingerprint: 'changed'
  })
  render(
    <RequestDialog
      config={config}
      request={serviceRequest}
      onClose={jest.fn()}
    />
  )
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'Accept request' }))
  await screen.findByText(/asset changed/)
  expect(authorizeMetadata).not.toHaveBeenCalled()
  expect(activateRequest).not.toHaveBeenCalled()
  expect(screen.getByRole('checkbox')).not.toBeChecked()
})
it('stops acceptance if authorization fails', async () => {
  verifiedReview()
  ;(authorizeMetadata as jest.Mock).mockRejectedValue(
    new Error('Authorization declined')
  )
  render(
    <RequestDialog
      config={config}
      request={serviceRequest}
      onClose={jest.fn()}
    />
  )
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'Accept request' }))
  await screen.findByText('Authorization declined')
  expect(activateRequest).not.toHaveBeenCalled()
})
it('skips authorization when the asset is already authorized', async () => {
  verifiedReview({ ...reviewData, metadataAuthorized: true })
  render(
    <RequestDialog
      config={config}
      request={serviceRequest}
      onClose={jest.fn()}
    />
  )
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'Accept request' }))
  await screen.findByText('New service created.')
  expect(authorizeMetadata).not.toHaveBeenCalled()
  expect(activateRequest).toHaveBeenCalled()
})
it('lets the sender view stored settings and requires confirmation before cancellation', async () => {
  ;(useAccount as jest.Mock).mockReturnValue({ address: 'requester' })
  ;(readRequest as jest.Mock).mockResolvedValue(serviceRequest)
  render(
    <RequestDialog
      config={config}
      request={serviceRequest}
      direction="sent"
      onClose={jest.fn()}
    />
  )
  expect(screen.getByText('Receiver', { exact: true })).toBeVisible()
  expect(
    screen.queryByText('Requester', { exact: true })
  ).not.toBeInTheDocument()
  expect(screen.getByText('Requested service settings')).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Retry verification' })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Accept request' })
  ).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel request' }))
  expect(mockMutate).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Keep request' }))
  expect(
    screen.queryByRole('button', { name: 'Confirm cancellation' })
  ).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel request' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }))
  await waitFor(() =>
    expect(mockMutate).toHaveBeenCalledWith({
      action: 'cancel',
      args: [1n],
      onSubmitted: expect.any(Function)
    })
  )
})

it('does not repeat authorization if it was already confirmed during a prior attempt', async () => {
  verifiedReview()
  ;(reviewActivation as jest.Mock).mockResolvedValue({
    ...reviewData,
    metadataAuthorized: true
  })
  render(
    <RequestDialog
      config={config}
      request={serviceRequest}
      onClose={jest.fn()}
    />
  )
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'Accept request' }))
  await screen.findByText('New service created.')
  expect(authorizeMetadata).not.toHaveBeenCalled()
  expect(activateRequest).toHaveBeenCalled()
})

it('does not offer cancellation after the sent request has been decided', () => {
  ;(useAccount as jest.Mock).mockReturnValue({ address: 'requester' })
  const approved = { ...serviceRequest, status: 1, decidedBy: 'receiver' }
  ;(useQuery as jest.Mock).mockImplementation(({ queryKey }) =>
    queryKey.includes('record') ? { data: approved } : { isError: true }
  )
  render(
    <RequestDialog
      config={config}
      request={approved}
      direction="sent"
      onClose={jest.fn()}
    />
  )
  expect(screen.getByText('Requested service settings')).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Cancel request' })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Retry verification' })
  ).not.toBeInTheDocument()
})

it('requires a new review when a background refresh changes the asset fingerprint', () => {
  verifiedReview()
  const { rerender } = render(
    <RequestDialog
      config={config}
      request={serviceRequest}
      onClose={jest.fn()}
    />
  )
  fireEvent.click(screen.getByRole('checkbox'))
  expect(screen.getByRole('button', { name: 'Accept request' })).toBeEnabled()
  verifiedReview({ ...reviewData, fingerprint: 'changed-in-background' })
  rerender(
    <RequestDialog
      config={config}
      request={serviceRequest}
      onClose={jest.fn()}
    />
  )
  expect(screen.getByRole('checkbox')).not.toBeChecked()
  expect(screen.getByRole('button', { name: 'Accept request' })).toBeDisabled()
})

it('keeps confirmed approval separate from a metadata observation failure', async () => {
  verifiedReview({ ...reviewData, metadataAuthorized: true })
  ;(observePermission as jest.Mock).mockRejectedValue(
    new Error('Metadata offline')
  )
  render(
    <RequestDialog
      config={config}
      request={serviceRequest}
      onClose={jest.fn()}
    />
  )
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'Accept request' }))
  await screen.findByText(/Could not verify the metadata cache yet/)
  expect(activateRequest).toHaveBeenCalledTimes(1)
  expect(
    screen.queryByText(/Approval could not be confirmed/)
  ).not.toBeInTheDocument()
})

it.each(['received', 'sent'] as const)(
  'shows the blockchain message read only in %s details',
  (direction) => {
    render(
      <RequestDialog
        config={config}
        request={{ ...request, message: 'Please enable access.\nThanks!' }}
        direction={direction}
        onClose={jest.fn()}
      />
    )
    const field = screen.getByRole('textbox', { name: 'Message' })
    expect(field).toHaveValue('Please enable access.\nThanks!')
    expect(field).toHaveAttribute('readonly')
  }
)

it.each(['jsonWallet', 'injected'])(
  'shows decision progress for %s with a leading spinner',
  async (connectorId) => {
    verifiedReview()
    ;(useAccount as jest.Mock).mockReturnValue({
      address: 'receiver',
      connector: { id: connectorId }
    })
    let finish: () => void
    mockMutate.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        })
    )
    render(
      <RequestDialog
        config={config}
        request={serviceRequest}
        direction="received"
        onClose={jest.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Reject request' }))
    const progress = await screen.findByText(
      connectorId === 'jsonWallet'
        ? 'Signing and submitting your decision automatically.'
        : 'Confirm the decision in your wallet.'
    )
    expect(progress.previousElementSibling).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    await waitFor(() => expect(mockMutate).toHaveBeenCalled())
    finish()
    await screen.findByText('Decision confirmed.')
  }
)
