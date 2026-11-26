import { translate } from '../../i18n/translate'
import { useLingui } from '@lingui/react'
import { i18n } from '../../i18n/index'
import NotificationBadge from './NotificationBadge'
import { ReactElement, useEffect, useState } from 'react'
import { useAccount, useChainId } from 'wagmi'
import Tabs from '@shared/atoms/Tabs'
import Button from '@shared/atoms/Button'
import { RegistryConfig } from '@utils/accessRequests/config'
import {
  useAccessRequestConfig,
  useRequestPages,
  useChainTime
} from '@hooks/useAccessRequests'
import RequestTable from './RequestTable'
import styles from './index.module.css'

/** Incrementally load the ledger so default sorting includes every request. */
function useLoadPages({
  hasNextPage,
  isFetching,
  isError,
  fetchNextPage
}: {
  hasNextPage: boolean
  isFetching: boolean
  isError: boolean
  fetchNextPage: () => unknown
}) {
  useEffect(() => {
    if (hasNextPage && !isFetching && !isError) fetchNextPage()
  }, [hasNextPage, isFetching, isError, fetchNextPage])
}

function Inbox({
  config,
  direction,
  wallet
}: {
  config: RegistryConfig
  direction: 'received' | 'sent'
  wallet: string
}): ReactElement {
  useLingui()
  const pages = useRequestPages(
    config,
    direction === 'sent' ? 'requester' : 'receiver',
    wallet
  )
  const time = useChainTime(config)
  useLoadPages(pages)
  return (
    <div className={styles.panel}>
      <RequestTable
        config={config}
        direction={direction}
        requests={pages.data?.pages.flatMap((page) => page.requests) || []}
        now={time.data}
        loading={pages.isPending}
      />
      <p role="status">
        {pages.isError
          ? direction === 'sent'
            ? i18n._(
                'Could not load all sent requests. Results may be incomplete.'
              )
            : i18n._(
                'Could not load all received requests. Results may be incomplete.'
              )
          : pages.hasNextPage
          ? i18n._(
              'Loading more requests. Filters and sorting currently apply to loaded requests.'
            )
          : ''}
      </p>
      <Button
        size="small"
        style="text"
        onClick={() =>
          pages.isError && pages.hasNextPage
            ? pages.fetchNextPage()
            : pages.refetch()
        }
      >
        {i18n._('Refresh requests')}
      </Button>
    </div>
  )
}

export default function AccessRequests(): ReactElement {
  useLingui()
  const { address: wallet } = useAccount()
  const chainId = useChainId()
  const { config, error } = useAccessRequestConfig(chainId)
  const [tab, setTab] = useState(0)
  if (!wallet)
    return <p>{i18n._('Connect your wallet to view access requests.')}</p>
  if (!config)
    return (
      <p role="status">
        {(error && translate(error)) ||
          i18n._(
            'Access requests are unavailable on this network or have not been configured.'
          )}
      </p>
    )
  return (
    <div key={`${wallet}:${chainId}:${config.address}`}>
      <Tabs
        selectedIndex={tab}
        onIndexSelected={setTab}
        items={[
          {
            title: i18n._('Received'),
            badge: <NotificationBadge direction="received" />,
            content: (
              <Inbox config={config} direction="received" wallet={wallet} />
            )
          },
          {
            title: i18n._('Sent'),
            badge: <NotificationBadge direction="sent" />,
            content: <Inbox config={config} direction="sent" wallet={wallet} />
          }
        ]}
      />
    </div>
  )
}
