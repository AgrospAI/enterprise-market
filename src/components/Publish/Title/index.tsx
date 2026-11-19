import { Trans, useLingui } from '@lingui/react'
import { ReactElement } from 'react'
import NetworkName from '@shared/NetworkName'
import Tooltip from '@shared/atoms/Tooltip'
import styles from './index.module.css'
import { contentPublishIndex as content } from '../../../i18n/content'
import Info from '@images/info.svg'
import AvailableNetworks from '@components/Publish/AvailableNetworks'
import useNetworkMetadata from '@hooks/useNetworkMetadata'
import { useAccount } from 'wagmi'

export default function Title({
  networkId
}: {
  networkId: number
}): ReactElement {
  useLingui()

  const { address: accountId } = useAccount()
  const { isSupportedOceanNetwork } = useNetworkMetadata()

  return (
    <div className={styles.titleContainer}>
      <span className={styles.titleText}>{content.title}</span>
      {networkId && (
        <>
          <span className={styles.intoText}>
            <Trans id="into" />
          </span>
          <div className={styles.networkContainer}>
            <NetworkName
              networkId={networkId}
              className={
                isSupportedOceanNetwork || !accountId
                  ? styles.network
                  : `${styles.network} ${styles.error}`
              }
            />
            <Tooltip
              content={<AvailableNetworks />}
              className={
                isSupportedOceanNetwork || !accountId
                  ? styles.tooltip
                  : `${styles.tooltip} ${styles.error}`
              }
            >
              <Info className={styles.infoIcon} />
            </Tooltip>
          </div>
        </>
      )}
    </div>
  )
}
