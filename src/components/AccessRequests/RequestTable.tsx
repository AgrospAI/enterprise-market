import { translate } from '../../i18n/translate'
import { useLingui } from '@lingui/react'
import { i18n } from '../../i18n/index'
import { CountBadge } from './NotificationBadge'
import { useRequestNotifications } from '@hooks/useRequestNotifications'
import { useRegistryMutation } from '@hooks/useAccessRequests'
import { requestStatus } from '@utils/accessRequests/status'
import { ReactElement, useState } from 'react'
import Table, { TableOceanColumn } from '@shared/atoms/Table'
import Button from '@shared/atoms/Button'
import { RegistryConfig } from '@utils/accessRequests/config'
import { AccessRequest } from 'src/@types/AccessRequest'
import { Asset } from 'src/@types/Asset'
import RequestAssetCell from './RequestAssetCell'
import RequestDialog from './RequestDialog'
import styles from './index.module.css'
import WalletLabel from './WalletLabel'
import { useQueries } from '@tanstack/react-query'
import { requestAssetQuery } from '@hooks/useRequestAsset'

export default function RequestTable({
  config,
  direction,
  requests,
  now,
  assets = [],
  loading
}: {
  config: RegistryConfig
  direction: 'received' | 'sent'
  requests: AccessRequest[]
  now?: bigint
  assets?: Asset[]
  loading?: boolean
}): ReactElement {
  useLingui()
  const notifications = useRequestNotifications()
  const markSeen = useRegistryMutation(config)
  const [seenError, setSeenError] = useState('')
  const [selected, setSelected] = useState<AccessRequest>()
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [resetPage, setResetPage] = useState(false)
  const assetsByNft = new Map(
    assets.map((asset) => [
      asset.credentialSubject.nftAddress.toLowerCase(),
      asset
    ])
  )
  const unresolvedNfts = [
    ...new Set(requests.map((request) => request.datasetNft.toLowerCase()))
  ].filter((nft) => !assetsByNft.has(nft))
  const metadata = useQueries({
    queries: unresolvedNfts.map((nft) => requestAssetQuery(config.chainId, nft))
  })
  metadata.forEach(({ data }) => {
    if (data)
      assetsByNft.set(data.credentialSubject.nftAddress.toLowerCase(), data)
  })
  const normalizedSearch = search.trim().toLowerCase()
  const filtered = requests.filter((request) => {
    const asset = assetsByNft.get(request.datasetNft.toLowerCase())
    return (
      (!status || requestStatus(request, now) === status) &&
      (!normalizedSearch ||
        [
          request.id.toString(),
          request.datasetNft,
          request.datasetServiceId,
          request.serviceTerms,
          request.requester,
          request.receiver,
          asset?.id,
          asset?.credentialSubject.metadata.name
        ].some((value) => value?.toLowerCase().includes(normalizedSearch)))
    )
  })
  const columns: TableOceanColumn<AccessRequest>[] = [
    {
      name: i18n._('Asset'),
      sortable: true,
      selector: (r) =>
        assetsByNft.get(r.datasetNft.toLowerCase())?.credentialSubject.metadata
          .name || r.datasetNft,
      cell: (r) => (
        <RequestAssetCell
          chainId={config.chainId}
          nft={r.datasetNft}
          type="Asset"
          knownAsset={assetsByNft.get(r.datasetNft.toLowerCase())}
        />
      ),
      grow: 2
    },
    {
      name: direction === 'sent' ? i18n._('Receiver') : i18n._('Requester'),
      cell: (r) => (
        <WalletLabel
          address={direction === 'sent' ? r.receiver : r.requester}
        />
      ),
      grow: 2
    },
    {
      id: 'status',
      name: i18n._('Status'),
      sortable: true,
      selector: (r) => requestStatus(r, now),
      sortFunction: (a, b) => {
        const left = requestStatus(a, now)
        const right = requestStatus(b, now)
        return (
          (left === 'Pending' ? 0 : 1) - (right === 'Pending' ? 0 : 1) ||
          left.localeCompare(right) ||
          Number(b.createdAt - a.createdAt)
        )
      },
      cell: (r) => (
        <span className={styles.status} data-status={requestStatus(r, now)}>
          {i18n._(requestStatus(r, now))}
        </span>
      )
    },
    {
      id: 'created',
      name: i18n._('Created'),
      sortable: true,
      selector: (r) => Number(r.createdAt),
      cell: (r) => (
        <time dateTime={new Date(Number(r.createdAt) * 1000).toISOString()}>
          {new Date(Number(r.createdAt) * 1000).toLocaleDateString(i18n.locale)}
        </time>
      )
    },
    {
      name: i18n._('Expires'),
      sortable: true,
      selector: (r) => Number(r.expiresAt),
      cell: (r) =>
        requestStatus(r, now) !== 'Pending' ? (
          <span>—</span>
        ) : (
          <time dateTime={new Date(Number(r.expiresAt) * 1000).toISOString()}>
            {new Date(Number(r.expiresAt) * 1000).toLocaleDateString(
              i18n.locale
            )}
          </time>
        )
    },
    {
      name: i18n._('Review'),
      cell: (r) => (
        <span className={styles.reviewAction}>
          <Button
            size="small"
            style="outlined"
            onClick={() => {
              setSelected(r)
              setSeenError('')
              const revision = notifications.data?.[r.id.toString()]
              if (revision && !markSeen.isPending) {
                markSeen.mutate(
                  { action: 'markSeen', args: [r.id, revision] },
                  {
                    onError: () =>
                      setSeenError(
                        'Could not mark activity as seen. Reopen Details to retry.'
                      )
                  }
                )
              }
            }}
            aria-label={i18n._('Review request {id}', { id: r.id.toString() })}
          >
            {i18n._('Details')}
          </Button>
          <CountBadge count={notifications.data?.[r.id.toString()] ? 1 : 0} />
        </span>
      )
    }
  ]
  return (
    <>
      {seenError && <p role="alert">{translate(seenError)}</p>}
      <div className={styles.filters}>
        <label>
          {i18n._('Search requests')}{' '}
          <input
            className={styles.field}
            type="search"
            value={search}
            placeholder={i18n._('Asset, service, wallet or request ID')}
            onChange={(e) => {
              setSearch(e.target.value)
              setResetPage(!resetPage)
            }}
          />
        </label>
        <label>
          {i18n._('Status')}{' '}
          <select
            className={styles.field}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setResetPage(!resetPage)
            }}
          >
            <option value="">{i18n._('All statuses')}</option>
            {[
              'Pending',
              'Approved',
              'Rejected',
              'Cancelled',
              'Expired',
              'Could not verify expiry'
            ].map((s) => (
              <option key={s} value={s}>
                {i18n._(s)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Table
        className={styles.requestTable}
        data={filtered}
        columns={columns}
        isLoading={loading}
        pagination
        paginationPerPage={10}
        paginationResetDefaultPage={resetPage}
        sortField="created"
        sortAsc={false}
        emptyMessage={i18n._('No matching access requests.')}
      />
      {selected && (
        <RequestDialog
          key={selected.id.toString()}
          config={config}
          request={selected}
          direction={direction}
          onClose={() => setSelected(undefined)}
        />
      )}
    </>
  )
}
