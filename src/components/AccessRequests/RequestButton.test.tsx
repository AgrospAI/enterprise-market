import ReactModal from 'react-modal'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import RequestButton from './RequestButton'
import { useAccessRequestConfig } from '@hooks/useAccessRequests'
import { resolveRequestAsset } from '@utils/accessRequests/activate'
import { getAccessDetails } from '@utils/accessDetailsAndPricing'
import { nftOwner } from '@utils/accessRequests/client'
import { Asset } from 'src/@types/Asset'
import { Service } from 'src/@types/ddo/Service'

const mockMutateAsync = jest.fn()
let mockConnectorId = 'injected'
let mockDebug = false
jest.mock('@context/UserPreferences', () => ({
  useUserPreferences: () => ({ debug: mockDebug })
}))
jest.mock('@utils/wallet/jsonWalletConnector', () => ({
  JSON_WALLET_CONNECTOR_ID: 'jsonWallet'
}))
jest.mock('@context/PontusXIdentity', () => ({
  usePublisherIdentities: () => [],
  usePontusXLegalName: () => undefined
}))
jest.mock('@hooks/useAccessRequests', () => ({
  useAccessRequestConfig: jest.fn(),
  useRegistryMutation: () => ({
    isPending: false,
    mutateAsync: mockMutateAsync
  }),
  accessRequestKey: (...args: unknown[]) => ['accessRequests', ...args]
}))
jest.mock('wagmi', () => ({
  useAccount: () => ({ address: 'wallet', connector: { id: mockConnectorId } }),
  useChainId: () => 11155420
}))
jest.mock('@utils/accessRequests/activate', () => ({
  resolveRequestAsset: jest.fn(),
  configuredEndpoint: () => true,
  validateRequestedAlgorithms: jest.fn()
}))
jest.mock('@utils/accessRequests/client', () => ({
  nftOwner: jest.fn(),
  sameAddress: (a, b) => a === b
}))
jest.mock('@utils/accessDetailsAndPricing', () => ({
  getAccessDetails: jest.fn()
}))
jest.mock('@utils/ocean', () => ({
  getOceanConfig: () => ({
    oceanTokenAddress: '0x1111111111111111111111111111111111111111'
  })
}))
jest.mock('@utils/compute', () => ({ createTrustedAlgorithmList: jest.fn() }))
jest.mock(
  '@shared/Web3Feedback',
  () =>
    function Feedback() {
      return <span>Wallet feedback</span>
    }
)
jest.mock(
  '@shared/ExplorerLink',
  () =>
    function Explorer() {
      return <span>Transaction</span>
    }
)
jest.mock('@utils/aquarius', () => ({
  generateBaseQuery: jest.fn(),
  queryMetadata: async () => ({ results: [] }),
  getFilterTerm: jest.fn()
}))

const service = {
  id: 'source',
  name: 'Original',
  description: {
    '@value': 'Original description',
    '@language': 'en',
    '@direction': 'ltr'
  },
  type: 'compute',
  state: 0,
  timeout: 3600,
  files: 'encrypted',
  compute: {
    allowRawAlgorithm: false,
    allowNetworkAccess: true,
    publisherTrustedAlgorithms: [],
    publisherTrustedAlgorithmPublishers: []
  }
} as Service
const asset = {
  id: 'did:op:asset',
  credentialSubject: {
    chainId: 11155420,
    nftAddress: 'nft',
    metadata: { type: 'dataset', name: 'Dataset' },
    services: [service]
  },
  indexedMetadata: { nft: { state: 0 } }
} as Asset

beforeAll(() => ReactModal.setAppElement(document.createElement('div')))
beforeEach(() => {
  jest.clearAllMocks()
  mockConnectorId = 'injected'
  ;(useAccessRequestConfig as jest.Mock).mockReturnValue({
    config: { chainId: 11155420, address: 'registry' }
  })
  ;(resolveRequestAsset as jest.Mock).mockResolvedValue(asset)
  ;(getAccessDetails as jest.Mock).mockResolvedValue({
    type: 'fixed',
    price: '2.5',
    baseToken: { address: '0x1111111111111111111111111111111111111111' }
  })
  ;(nftOwner as jest.Mock).mockResolvedValue('owner')
  mockMutateAsync.mockResolvedValue({})
})
function show(selected = service, value = asset) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })
  return render(
    <QueryClientProvider client={client}>
      <RequestButton asset={value} service={selected} />
    </QueryClientProvider>
  )
}
async function open() {
  fireEvent.click(screen.getByRole('button', { name: 'Request access' }))
  await screen.findByRole('textbox', { name: 'Service name' })
}
it('prefills all requested fields from the original service', async () => {
  show()
  await open()
  expect(screen.getByRole('textbox', { name: 'Service name' })).toHaveValue(
    'Original'
  )
  expect(
    screen.getByRole('textbox', { name: 'Service description' })
  ).toHaveValue('Original description')
  expect(screen.getByRole('spinbutton', { name: 'Price' })).toHaveValue(2.5)
  expect(
    screen.getByRole('spinbutton', { name: 'Custom duration (seconds)' })
  ).toHaveValue(3600)
  expect(
    screen.getByRole('checkbox', { name: 'Allow network access' })
  ).toBeChecked()
  expect(
    screen.queryByRole('checkbox', { name: 'Allow any published algorithm' })
  ).not.toBeInTheDocument()
  expect(
    screen.getByRole('link', { name: 'Wallet account (You)' })
  ).toHaveAttribute('href', '/profile/wallet')
  expect(
    screen.getByRole('combobox', { name: 'Allowed algorithms' })
  ).toBeVisible()
  expect(
    screen.getByRole('combobox', { name: 'Allowed trusted publishers' })
  ).toBeVisible()
})
it('submits one immutable proposal containing all the requested changes', async () => {
  show()
  await open()
  fireEvent.change(screen.getByRole('textbox', { name: 'Service name' }), {
    target: { value: 'Custom service' }
  })
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Message (optional)' }),
    {
      target: { value: 'Please enable this service.\nThank you!' }
    }
  )
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Service description' }),
    {
      target: { value: 'Updated description' }
    }
  )
  fireEvent.click(screen.getByRole('checkbox', { name: 'Free access' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Unlimited access' }))
  expect(
    screen.queryByRole('spinbutton', { name: 'Price' })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('combobox', { name: 'Access duration' })
  ).not.toBeInTheDocument()
  fireEvent.click(
    screen.getByRole('checkbox', { name: 'Allow network access' })
  )
  fireEvent.click(screen.getByRole('button', { name: 'Request new service' }))
  await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1))
  const call = mockMutateAsync.mock.calls[0][0]
  expect(JSON.parse(call.args[2]).description).toBe('Updated description')
  expect(call.action).toBe('createServiceRequest')
  expect(call.args.slice(0, 2)).toEqual(['nft', 'source'])
  expect(call.args[3]).toBe('owner')
  expect(call.args[4]).toBe('Please enable this service.\nThank you!')
  expect(JSON.parse(call.args[2])).toMatchObject({
    name: 'Custom service',
    price: '0',
    timeout: 0,
    compute: { allowNetworkAccess: false }
  })
  expect(service.name).toBe('Original')
  await screen.findByText(/Your request has been submitted/)
  expect(
    screen.queryByRole('button', { name: 'Request new service' })
  ).not.toBeInTheDocument()
})
it('supports download services without compute options', async () => {
  const source = { ...service, type: 'access', compute: undefined }
  ;(resolveRequestAsset as jest.Mock).mockResolvedValue({
    ...asset,
    credentialSubject: { ...asset.credentialSubject, services: [source] }
  })
  show(source)
  await open()
  expect(
    screen.queryByRole('checkbox', { name: 'Allow network access' })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('combobox', { name: 'Allowed algorithms' })
  ).not.toBeInTheDocument()
  expect(screen.getByRole('spinbutton', { name: 'Price' })).toHaveValue(2.5)
})
it('refuses submission if the source changed', async () => {
  show()
  await open()
  ;(resolveRequestAsset as jest.Mock).mockResolvedValue({
    ...asset,
    credentialSubject: {
      ...asset.credentialSubject,
      services: [{ ...service, timeout: 60 }]
    }
  })
  fireEvent.click(screen.getByRole('button', { name: 'Request new service' }))
  await screen.findByText(/original service changed/)
  expect(mockMutateAsync).not.toHaveBeenCalled()
})
it('does not replace an unavailable original price with a zero default', async () => {
  ;(getAccessDetails as jest.Mock).mockResolvedValue({
    type: 'NOT_SUPPORTED',
    price: '0'
  })
  show()
  fireEvent.click(screen.getByRole('button', { name: 'Request access' }))
  await screen.findByRole('alert')
  expect(
    screen.queryByRole('button', { name: 'Request new service' })
  ).not.toBeInTheDocument()
})
it('keeps the request card visible but disabled when unavailable', () => {
  const { unmount } = show({ ...service, state: 4 })
  expect(screen.getByRole('button', { name: 'Request access' })).toBeDisabled()
  unmount()
  ;(useAccessRequestConfig as jest.Mock).mockReturnValue({})
  show()
  expect(screen.getByRole('button', { name: 'Request access' })).toBeDisabled()
})

it('preserves paid settings when toggled back and submits preset durations', async () => {
  show()
  await open()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Free access' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Free access' }))
  expect(screen.getByRole('spinbutton', { name: 'Price' })).toHaveValue(2.5)
  fireEvent.change(screen.getByRole('combobox', { name: 'Access duration' }), {
    target: { value: '604800' }
  })
  expect(
    screen.queryByRole('spinbutton', { name: 'Custom duration (seconds)' })
  ).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Request new service' }))
  await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1))
  expect(JSON.parse(mockMutateAsync.mock.calls[0][0].args[2])).toMatchObject({
    price: '2.5',
    timeout: 604800
  })
})

it('keeps zero custom durations visible and blocks accidental unlimited submissions', async () => {
  show()
  await open()
  const duration = screen.getByRole('spinbutton', {
    name: 'Custom duration (seconds)'
  })
  fireEvent.change(duration, { target: { value: '0' } })
  expect(duration).toBeVisible()
  expect(duration).toBeInvalid()
  expect(
    screen.getByRole('checkbox', { name: 'Unlimited access' })
  ).not.toBeChecked()
  fireEvent.click(screen.getByRole('button', { name: 'Request new service' }))
  expect(mockMutateAsync).not.toHaveBeenCalled()
})

it.each(['0', '-1', '-0.5'])('rejects a paid price of %s', async (value) => {
  show()
  await open()
  const price = screen.getByRole('spinbutton', { name: 'Price' })
  expect(screen.getByText('devEURAU')).toBeVisible()
  expect(screen.queryByText(/Payment token:/)).not.toBeInTheDocument()
  fireEvent.change(price, { target: { value } })
  expect(price).toHaveValue(null)
  expect(price).toBeInvalid()
  fireEvent.click(screen.getByRole('button', { name: 'Request new service' }))
  expect(mockMutateAsync).not.toHaveBeenCalled()
})

it('disables custom selectors throughout submission', async () => {
  let finish: () => void
  mockMutateAsync.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      })
  )
  show()
  await open()
  fireEvent.click(screen.getByRole('button', { name: 'Request new service' }))
  await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1))
  expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  expect(screen.getByLabelText('Allowed algorithms')).toBeDisabled()
  expect(screen.getByLabelText('Allowed trusted publishers')).toBeDisabled()
  finish()
  await screen.findByText(/Your request has been submitted/)
})

it('submits an empty message when the optional field is left blank', async () => {
  show()
  await open()
  fireEvent.click(screen.getByRole('button', { name: 'Request new service' }))
  await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1))
  expect(mockMutateAsync.mock.calls[0][0].args[4]).toBe('')
})

it('rejects messages exceeding the UTF-8 byte limit before submitting', async () => {
  show()
  await open()
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Message (optional)' }),
    {
      target: { value: 'é'.repeat(1025) }
    }
  )
  fireEvent.click(screen.getByRole('button', { name: 'Request new service' }))
  await screen.findByText('Message must be 2048 bytes or fewer.')
  expect(mockMutateAsync).not.toHaveBeenCalled()
})

it.each(['jsonWallet', 'injected'])(
  'shows appropriate signing and confirmation messages for %s',
  async (connectorId) => {
    mockConnectorId = connectorId
    mockDebug = connectorId === 'injected'
    let finish: () => void
    mockMutateAsync.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        })
    )
    show()
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Request new service' }))
    await screen.findByText(
      connectorId === 'jsonWallet'
        ? 'Signing and submitting your request automatically.'
        : 'Confirm the new service request in your wallet.'
    )
    act(() => mockMutateAsync.mock.calls[0][0].onSubmitted('0x123'))
    expect(
      screen.getByText('Your request is being confirmed. No action is needed.')
    ).toBeVisible()
    finish()
    await screen.findByText(
      'Your request has been submitted. You will be notified when the request is approved or rejected.'
    )
    expect(
      screen.queryByRole('textbox', { name: 'Service name' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText('Base service to clone')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Close' })
    ).not.toBeInTheDocument()
    if (mockDebug) expect(screen.getByText('Transaction')).toBeVisible()
    else expect(screen.queryByText('Transaction')).not.toBeInTheDocument()
  }
)

it('selects a download base independently from requested compute access', async () => {
  const download = {
    ...service,
    id: 'download',
    name: 'Download base',
    type: 'access',
    compute: undefined
  }
  const value = {
    ...asset,
    credentialSubject: {
      ...asset.credentialSubject,
      services: [service, download]
    }
  }
  ;(resolveRequestAsset as jest.Mock).mockResolvedValue(value)
  show(service, value)
  await open()
  fireEvent.keyDown(
    screen.getByRole('combobox', { name: 'Base service to clone' }),
    { key: 'ArrowDown' }
  )
  fireEvent.click(screen.getByText('Download base (Download)'))
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'Service name' })).toHaveValue(
      'Download base'
    )
  )
  fireEvent.click(screen.getByRole('radio', { name: 'Compute' }))
  expect(
    screen.getByRole('checkbox', { name: 'Allow network access' })
  ).not.toBeChecked()
  fireEvent.click(screen.getByRole('button', { name: 'Request new service' }))
  await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1))
  const { args } = mockMutateAsync.mock.calls[0][0]
  expect(args[1]).toBe('download')
  expect(JSON.parse(args[2])).toMatchObject({
    type: 'compute',
    compute: { allowRawAlgorithm: false }
  })
})
