import { useLingui } from '@lingui/react'
import { i18n } from '../../../i18n/index'
import { Fragment, ReactElement } from 'react'
import styles from './index.module.css'
import Network from './Network'
import useNetworkMetadata, {
  filterNetworksByType
} from '@hooks/useNetworkMetadata'
import { contentPublishIndex as content } from '../../../i18n/content'
import { useMarketMetadata } from '@context/MarketMetadata'

export default function AvailableNetworks(): ReactElement {
  useLingui()

  const { networksList } = useNetworkMetadata()
  const { validatedSupportedChains } = useMarketMetadata()
  const supportedChainIds = validatedSupportedChains

  const networksMain = filterNetworksByType(
    'mainnet',
    supportedChainIds,
    networksList
  )

  const networksTest = filterNetworksByType(
    'testnet',
    supportedChainIds,
    networksList
  )
  const networkCategories = [
    { title: i18n._('Main'), data: networksMain },
    { title: i18n._('Test'), data: networksTest }
  ]
  const networkList = (networks: number[]) =>
    networks.map((chainId) => (
      <li key={chainId}>
        <Network chainId={chainId} />
      </li>
    ))

  return (
    <div className={styles.content}>
      {content.tooltipAvailableNetworks}
      {networkCategories.map(
        (networkCategory) =>
          networkCategory.data.length > 0 && (
            <Fragment key={networkCategory.title}>
              <h4 className={styles.title}>{networkCategory.title}</h4>
              <ul className={styles.networks}>
                {networkList(networkCategory.data)}
              </ul>
            </Fragment>
          )
      )}
    </div>
  )
}
