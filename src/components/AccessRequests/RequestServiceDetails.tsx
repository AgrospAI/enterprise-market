import { useLingui } from '@lingui/react'
import { i18n } from '../../i18n/index'
import { ReactElement, useId } from 'react'
import { ServiceTerms } from '@utils/accessRequests/service'
import { useMarketMetadata } from '@context/MarketMetadata'
import { useChainId } from 'wagmi'
import ExplorerLink from '@shared/ExplorerLink'
import CopyIconButton from '@shared/atoms/CopyIconButton'
import RequestAssetCell from './RequestAssetCell'
import WalletLabel from './WalletLabel'
import styles from './index.module.css'
import { truncateIdentifier } from '@utils/string'
import reviewStyles from './RequestDialog.module.css'

function durationLabel(seconds: number): string {
  if (seconds === 0) return i18n._('Unlimited')
  if (seconds % 86400 === 0)
    return i18n._('{count, plural, one {# day} other {# days}}', {
      count: seconds / 86400
    })
  if (seconds % 3600 === 0)
    return i18n._('{count, plural, one {# hour} other {# hours}}', {
      count: seconds / 3600
    })
  return i18n._('{count, plural, one {# second} other {# seconds}}', {
    count: seconds
  })
}

/** The same read-only terms summary serves the sender and receiver. */
export default function RequestServiceDetails({
  terms,
  allowedAddress,
  chainId
}: {
  terms: ServiceTerms
  allowedAddress: string
  chainId: number
}): ReactElement {
  useLingui()
  const headingId = useId()
  const { approvedBaseTokens } = useMarketMetadata()
  const activeChainId = useChainId()
  const token =
    activeChainId === chainId
      ? approvedBaseTokens?.find(
          (t) => t.address.toLowerCase() === terms.baseToken.toLowerCase()
        )
      : undefined
  return (
    <section className={reviewStyles.terms} aria-labelledby={headingId}>
      <h3 id={headingId}>{i18n._('Requested service settings')}</h3>
      <dl className={reviewStyles.metadata}>
        <div>
          <dt>{i18n._('Access type')}</dt>
          <dd>
            {(terms.type ?? (terms.compute ? 'compute' : 'access')) ===
            'compute'
              ? i18n._('Compute')
              : i18n._('Download')}
          </dd>
        </div>
        <div>
          <dt>{i18n._('Service name')}</dt>
          <dd>{terms.name}</dd>
        </div>
        {terms.description !== undefined && (
          <div>
            <dt>{i18n._('Service description')}</dt>
            <dd>{terms.description || '—'}</dd>
          </div>
        )}
        <div>
          <dt>{i18n._('Allowed ETH address')}</dt>
          <dd>
            <WalletLabel address={allowedAddress} />
          </dd>
        </div>
        <div>
          <dt>{i18n._('Price')}</dt>
          <dd>
            {Number(terms.price) === 0
              ? i18n._('Free access')
              : `${terms.price}${token?.symbol ? ` ${token.symbol}` : ''}`}
          </dd>
        </div>
        <div>
          <dt>{i18n._('Access duration')}</dt>
          <dd>{durationLabel(terms.timeout)}</dd>
        </div>
        {Number(terms.price) !== 0 && (
          <div>
            <dt>{i18n._('Payment token')}</dt>
            <dd>
              <ExplorerLink
                networkId={chainId}
                path={`address/${terms.baseToken}`}
              >
                {token?.name || token?.symbol || i18n._('Payment token')}
              </ExplorerLink>
              <span className={styles.identifier}>
                <code title={terms.baseToken}>
                  {truncateIdentifier(terms.baseToken)}
                </code>
                <CopyIconButton
                  text={terms.baseToken}
                  copyAriaLabel={i18n._('Copy payment token')}
                />
              </span>
            </dd>
          </div>
        )}
        {terms.compute && (
          <>
            <div>
              <dt>{i18n._('Network access')}</dt>
              <dd>
                {terms.compute.allowNetworkAccess
                  ? i18n._('Allowed')
                  : i18n._('Disabled')}
              </dd>
            </div>
            <div>
              <dt>{i18n._('Allowed algorithms')}</dt>
              <dd className={reviewStyles.identityList}>
                {terms.compute.allowAllPublishedAlgorithms ||
                terms.compute.publisherTrustedAlgorithms.some(
                  (a) => a.did === '*'
                )
                  ? i18n._('Any published algorithm')
                  : terms.compute.publisherTrustedAlgorithms.length
                  ? terms.compute.publisherTrustedAlgorithms.map((a) => (
                      <RequestAssetCell
                        key={`${a.did}:${a.serviceId}`}
                        chainId={chainId}
                        did={a.did}
                        type="Algorithm"
                      />
                    ))
                  : i18n._('None')}
              </dd>
            </div>
            <div>
              <dt>{i18n._('Trusted publishers')}</dt>
              <dd className={reviewStyles.identityList}>
                {terms.compute.publisherTrustedAlgorithmPublishers.includes('*')
                  ? i18n._('All publishers')
                  : terms.compute.publisherTrustedAlgorithmPublishers.length
                  ? terms.compute.publisherTrustedAlgorithmPublishers.map(
                      (address) => (
                        <WalletLabel key={address} address={address} />
                      )
                    )
                  : i18n._('None')}
              </dd>
            </div>
          </>
        )}
      </dl>
    </section>
  )
}
