import { Trans, useLingui } from '@lingui/react'
import { i18n } from '../../../i18n/index'
import { ReactElement, useEffect, useState } from 'react'
import styles from './index.module.css'
import WalletNetworkSwitcher from '../WalletNetworkSwitcher'
import Warning from '@images/warning.svg'
import { useModal } from 'connectkit'
import Tooltip from '@shared/atoms/Tooltip'
import useNetworkMetadata, {
  getNetworkDataById,
  getNetworkDisplayName
} from '@hooks/useNetworkMetadata'
import { useAsset } from '@context/Asset'
import { useChainId } from 'wagmi'

export default function Web3Feedback({
  accountId,
  isAssetNetwork
}: {
  accountId?: string
  isAssetNetwork?: boolean
}): ReactElement {
  useLingui()

  const [state, setState] = useState<string>()
  const [title, setTitle] = useState<string>()
  const [message, setMessage] = useState<string>()
  const [showFeedback, setShowFeedback] = useState<boolean>(false)

  const { setOpen } = useModal()

  const chainId = useChainId()
  const { asset } = useAsset()
  const { networksList } = useNetworkMetadata()

  const ddoNetworkId = asset?.credentialSubject?.chainId
  const ddoNetworkData = getNetworkDataById(networksList, ddoNetworkId)
  const walletNetworkData = getNetworkDataById(networksList, chainId)

  const ddoNetworkName = (
    <strong>{getNetworkDisplayName(ddoNetworkData)}</strong>
  )
  const walletNetworkName = (
    <strong>{getNetworkDisplayName(walletNetworkData)}</strong>
  )

  function handleConnectWallet() {
    setOpen(true)
  }

  useEffect(() => {
    setShowFeedback(!accountId || isAssetNetwork === false)
    if (accountId && isAssetNetwork) return
    if (!accountId) {
      setState('error')
      setTitle(i18n._('No account connected'))
      setMessage(i18n._('Please connect your wallet.'))
    } else if (isAssetNetwork === false) {
      setState('error')
      setTitle(i18n._('Not connected to asset network'))
      setMessage(i18n._('Please connect your wallet.'))
    } else {
      setState('warning')
      setTitle(i18n._('Something went wrong.'))
      setMessage(i18n._('Something went wrong.'))
    }
  }, [accountId, isAssetNetwork])

  return (
    <>
      {showFeedback && (
        <section className={styles.feedback} data-state={state}>
          <div className={styles.warningImage} aria-hidden="true">
            <Warning />
          </div>
          <div className={styles.text}>
            {isAssetNetwork === false ? (
              <Tooltip
                content={
                  <>
                    <Trans
                      id="This asset is published on {assetNetwork}, but your wallet is connected to {walletNetwork}. Connect to {assetNetwork} to interact with this asset."
                      values={{
                        assetNetwork: ddoNetworkName,
                        walletNetwork: walletNetworkName
                      }}
                    />{' '}
                  </>
                }
              >
                <h3 className={styles.title}>{title}</h3>
              </Tooltip>
            ) : (
              <h3 className={styles.title}>{title}</h3>
            )}
          </div>
          {isAssetNetwork === false ? (
            <WalletNetworkSwitcher />
          ) : (
            message && (
              <span className={styles.error} onClick={handleConnectWallet}>
                {message}
              </span>
            )
          )}
        </section>
      )}
    </>
  )
}
