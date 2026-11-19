import { useLingui } from '@lingui/react'
import { i18n } from '../../i18n/index'
import { useEffect, useState } from 'react'
import Alert from '@shared/atoms/Alert'
import Button from '@shared/atoms/Button'
import Loader from '@shared/atoms/Loader'
import Modal from '@shared/atoms/Modal'
import networkdata from '../../../content/networks-metadata.json'
import {
  getNetworkDataById,
  getNetworkDisplayName
} from '@hooks/useNetworkMetadata'
import styles from './NetworkWarningModal.module.css'

const MODAL_TITLE = 'Network Not Supported'
const ALERT_TITLE = 'Unsupported Network'
const NETWORK_ALERT_SUFFIX =
  'This network either has no approved tokens or is not configured for this marketplace.'
const CONFIG_ALERT_TITLE = 'Configuration Required'
const SWITCH_OPTIONS_ALERT_TITLE = 'No Switchable Networks'
const CONFIG_ALERT_TEXT =
  'NEXT_PUBLIC_ALLOWED_ERC20_ADDRESSES must be set with at least one supported chain and token address.'
const SWITCH_NETWORK_PROMPT = 'Please switch to one of the supported networks:'
const NETWORK_HINT = 'You can also switch networks directly from your wallet'

const CHAIN_NAMES: Record<number, string> = {
  get 1() {
    return i18n._('Ethereum Mainnet')
  },
  get 10() {
    return i18n._('Optimism')
  },
  get 11155111() {
    return i18n._('Ethereum Sepolia')
  },
  get 11155420() {
    return i18n._('OP Sepolia')
  },
  get 560048() {
    return i18n._('Ethereum Hoodi')
  },
  get 8996() {
    return i18n._('Pontus-X Testnet')
  },
  get 56() {
    return i18n._('BNB Smart Chain')
  },
  get 137() {
    return i18n._('Polygon')
  },
  get 42161() {
    return i18n._('Arbitrum')
  },
  get 43114() {
    return i18n._('Avalanche')
  }
}

const networksList: EthereumListsChain[] = networkdata

function getReadableNetworkName(chainId: number): string {
  if (CHAIN_NAMES[chainId]) return `${CHAIN_NAMES[chainId]} (${chainId})`

  const networkData = getNetworkDataById(networksList, chainId)
  const metadataDisplayName = getNetworkDisplayName(networkData)

  if (metadataDisplayName && metadataDisplayName !== 'Unknown') {
    return `${metadataDisplayName} (${chainId})`
  }

  return i18n._('Chain ID: {chainId}', { chainId })
}

interface NetworkWarningModalProps {
  chainId?: number
  isOpen: boolean
  isPending: boolean
  supportedChains: number[]
  emptySwitchOptionsText?: string
  onClose: () => void
  onSwitchChain: (targetChainId: number) => void
}

export default function NetworkWarningModal({
  chainId,
  isOpen,
  isPending,
  supportedChains,
  emptySwitchOptionsText,
  onClose,
  onSwitchChain
}: NetworkWarningModalProps) {
  useLingui()

  const [loadingChainId, setLoadingChainId] = useState<number | null>(null)

  useEffect(() => {
    if (!isPending) setLoadingChainId(null)
  }, [isPending])

  useEffect(() => {
    if (isOpen) return
    setLoadingChainId(null)
  }, [isOpen])

  if (!isOpen) return null

  const hasSupportedChains = supportedChains.length > 0
  const connectedNetworkName = chainId
    ? getReadableNetworkName(chainId)
    : i18n._('an unknown network')
  const alertTitle = hasSupportedChains
    ? ALERT_TITLE
    : emptySwitchOptionsText
    ? SWITCH_OPTIONS_ALERT_TITLE
    : CONFIG_ALERT_TITLE
  const alertText = hasSupportedChains
    ? i18n._(
        "You're connected to {connectedNetworkName}. {NETWORK_ALERT_SUFFIX}",
        {
          connectedNetworkName,
          NETWORK_ALERT_SUFFIX: i18n._(NETWORK_ALERT_SUFFIX)
        }
      )
    : emptySwitchOptionsText || CONFIG_ALERT_TEXT

  function handleSwitchClick(targetChainId: number) {
    if (isPending) return

    setLoadingChainId(targetChainId)
    try {
      onSwitchChain(targetChainId)
    } catch {
      setLoadingChainId(null)
    }
  }

  return (
    <Modal
      title={i18n._(MODAL_TITLE)}
      isOpen
      onToggleModal={onClose}
      shouldCloseOnOverlayClick
      className={styles.networkWarningModal}
    >
      <div className={styles.networkWarningContent}>
        <div className={styles.warningIcon}>⚠️</div>

        <Alert title={alertTitle} text={alertText} state="error" />

        {hasSupportedChains && (
          <>
            <p className={styles.warningSubtitle}>
              {i18n._(SWITCH_NETWORK_PROMPT)}
            </p>

            <div className={styles.networkList}>
              {supportedChains.map((id: number) => (
                <Button
                  key={id}
                  type="button"
                  style="secondary"
                  onClick={() => handleSwitchClick(id)}
                  disabled={isPending}
                  className={styles.networkSwitchButton}
                >
                  {loadingChainId === id && isPending ? (
                    <Loader
                      variant="primary"
                      noMargin
                      className={styles.buttonLoader}
                    />
                  ) : (
                    getReadableNetworkName(id)
                  )}
                </Button>
              ))}
            </div>

            <p className={styles.hint}>{i18n._(NETWORK_HINT)}</p>
          </>
        )}
      </div>
    </Modal>
  )
}
