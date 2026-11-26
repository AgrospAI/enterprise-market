import { i18n } from '../../i18n/index'
import { useRequestNotifications } from '@hooks/useRequestNotifications'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import RequestTable from './RequestTable'
import { AccessRequest } from 'src/@types/AccessRequest'
import { useQueries } from '@tanstack/react-query'
import { Asset } from 'src/@types/Asset'
const mockMarkSeen = jest.fn()
jest.mock('@hooks/useRequestNotifications', () => ({
  useRequestNotifications: jest.fn(() => ({ data: {} }))
}))
jest.mock('@hooks/useAccessRequests', () => ({
  useRegistryMutation: () => ({ mutate: mockMarkSeen, isPending: false })
}))

jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQueries: jest.fn(() => [])
}))
beforeEach(() => {
  ;(useQueries as jest.Mock).mockReturnValue([])
})

jest.mock('@context/PontusXIdentity', () => ({
  usePontusXLegalName: (address) =>
    address === 'receiver' ? 'Dataset owner' : 'Requester name'
}))
jest.mock('./RequestAssetCell', () => ({
  __esModule: true,
  default: ({ nft, type }) => (
    <a href={`/asset/${nft}`}>
      {type} {nft}
    </a>
  ),
  Identifier: ({ value, href }) => <a href={href}>{value}</a>
}))
jest.mock('./RequestDialog', () => ({
  __esModule: true,
  default: ({ request }) => (
    <div role="dialog">Request {request.id.toString()}</div>
  ),
  WalletLabel: ({ address }) => <a href={`/profile/${address}`}>{address}</a>
}))

jest.mock('@utils/aquarius', () => ({
  MAXIMUM_NUMBER_OF_PAGES_WITH_RESULTS: 1000
}))

const config = { chainId: 11155420, address: 'registry', deploymentBlock: 1 }
const row = (id: number, status = 0): AccessRequest => ({
  id: BigInt(id),
  status,
  requester: 'requester',
  receiver: 'receiver',
  datasetNft: `dataset-${id}`,
  datasetServiceId: 'compute',
  createdAt: BigInt(id),
  expiresAt: 100n,
  decidedAt: 0n,
  decidedBy: ''
})

it('shares a permission-independent ledger and names the sent account Receiver', () => {
  render(
    <RequestTable
      config={config}
      direction="sent"
      requests={[row(1), row(2), row(3)]}
      now={50n}
    />
  )
  expect(screen.getByText('Receiver')).toBeVisible()
  expect(screen.queryByText('Requester')).not.toBeInTheDocument()
  expect(screen.queryByText(/^Algorithm$/)).not.toBeInTheDocument()
  expect(screen.getByText('Asset', { exact: true })).toBeVisible()
  expect(screen.queryByText('Request type')).not.toBeInTheDocument()
  expect(screen.queryByText('Requested access')).not.toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: 'Dataset owner' })).toHaveLength(3)
})

it('defaults to newest first, paginates, filters and opens request details', () => {
  const requests = [
    row(1, 1),
    ...Array.from({ length: 11 }, (_, i) => row(i + 2, i === 10 ? 1 : 0))
  ]
  render(
    <RequestTable
      config={config}
      direction="received"
      requests={requests}
      now={50n}
    />
  )
  expect(screen.getByText('Requester')).toBeVisible()
  const first = screen.getAllByRole('row')[1]
  expect(
    within(first).getByRole('button', { name: 'Review request 12' })
  ).toBeVisible()
  expect(
    screen.getAllByRole('button', { name: /Review request/ })
  ).toHaveLength(10)
  fireEvent.click(screen.getAllByRole('button', { name: 'Next page' }).at(-1))
  expect(
    screen.getAllByRole('button', { name: /Review request/ })
  ).toHaveLength(2)
  fireEvent.change(screen.getByLabelText('Status'), {
    target: { value: 'Approved' }
  })
  expect(screen.getByRole('button', { name: 'Review request 1' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Review request 1' }))
  expect(screen.getByRole('dialog')).toHaveTextContent('Request 1')
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: '' } })
  expect(screen.queryByLabelText('Permission')).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Search requests'), {
    target: { value: 'dataset-4' }
  })
  expect(
    screen.getAllByRole('button', { name: /Review request/ })
  ).toHaveLength(1)
})

it.each([
  [0, 50n, false],
  [1, 50n, true],
  [2, 50n, true],
  [3, 50n, true],
  [0, 100n, true]
])(
  'shows expiry only for pending requests (status %s, time %s)',
  (status, now, hidden) => {
    render(
      <RequestTable
        config={config}
        direction="received"
        requests={[row(1, status)]}
        now={now}
      />
    )
    const cells = within(screen.getAllByRole('row')[1]).getAllByRole('cell')
    if (hidden) expect(cells[4]).toHaveTextContent('—')
    else
      expect(cells[4].querySelector('time')).toHaveAttribute(
        'dateTime',
        new Date(100000).toISOString()
      )
  }
)

it('searches metadata loaded for the visible asset identities', () => {
  ;(useQueries as jest.Mock).mockReturnValue([
    {
      data: {
        id: 'did:op:red-wine',
        credentialSubject: {
          nftAddress: 'dataset-1',
          metadata: { name: 'Red Wine' }
        }
      } as Asset
    }
  ])
  render(
    <RequestTable
      config={config}
      direction="received"
      requests={[row(1), row(2)]}
      now={50n}
    />
  )
  fireEvent.change(screen.getByLabelText('Search requests'), {
    target: { value: 'Red Wine' }
  })
  expect(screen.getByRole('button', { name: 'Review request 1' })).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Review request 2' })
  ).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Search requests'), {
    target: { value: 'did:op:red-wine' }
  })
  expect(screen.getByRole('button', { name: 'Review request 1' })).toBeVisible()
})

it('marks only the opened request activity as seen on chain', () => {
  ;(useRequestNotifications as jest.Mock).mockReturnValue({ data: { '1': 2 } })
  render(
    <RequestTable
      config={config}
      direction="received"
      requests={[row(1), row(2)]}
      now={100n}
    />
  )
  expect(screen.getAllByLabelText('1 unread notification')).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Review request 1' }))
  expect(mockMarkSeen).toHaveBeenCalledWith(
    { action: 'markSeen', args: [1n, 2] },
    expect.objectContaining({ onError: expect.any(Function) })
  )
  expect(screen.getByRole('dialog')).toBeVisible()
})

it('shows an error when marking activity as seen fails', () => {
  ;(useRequestNotifications as jest.Mock).mockReturnValue({ data: { '1': 2 } })
  mockMarkSeen.mockClear()
  render(
    <RequestTable
      config={config}
      direction="received"
      requests={[row(1)]}
      now={50n}
    />
  )
  fireEvent.click(screen.getByRole('button', { name: 'Review request 1' }))
  act(() => mockMarkSeen.mock.calls[0][1].onError(new Error('Failed')))
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Could not mark activity as seen. Reopen Details to retry.'
  )
})

it.each([
  ['es', 'Estado', 'Aprobada', 'Revisar solicitud 1', 'Revisar solicitud 2'],
  ['de', 'Status', 'Genehmigt', 'Anfrage 1 prüfen', 'Anfrage 2 prüfen']
])(
  'keeps status filter values stable in %s and updates when the locale changes',
  (locale, label, approved, first, second) => {
    render(
      <RequestTable
        config={config}
        direction="received"
        requests={[row(1, 1), row(2)]}
        now={50n}
      />
    )
    try {
      act(() => i18n.activate(locale))
      const option = screen.getByRole('option', { name: approved })
      expect(option).toHaveValue('Approved')
      fireEvent.change(screen.getByLabelText(label), {
        target: { value: 'Approved' }
      })
      expect(screen.getByRole('button', { name: first })).toBeVisible()
      expect(
        screen.queryByRole('button', { name: second })
      ).not.toBeInTheDocument()
      expect(
        document.querySelector('[data-status="Approved"]')
      ).toHaveTextContent(approved)
    } finally {
      act(() => i18n.activate('en'))
    }
  }
)
