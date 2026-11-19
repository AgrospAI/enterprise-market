import { useLingui } from '@lingui/react'
import { i18n } from '../../../i18n/index'
import { ReactElement } from 'react'
import styles from './index.module.css'
import useNetworkMetadata, {
  getNetworkDataById,
  getNetworkDisplayName
} from '@hooks/useNetworkMetadata'
import { useAsset } from '@context/Asset'
import { useSwitchChain } from 'wagmi'
import { useIsChainSupportedByConnector } from '@hooks/useDfnsWalletsByChain'
import Button from '@shared/atoms/Button'
import Tooltip from '@shared/atoms/Tooltip'

export default function WalletNetworkSwitcher(): ReactElement {
  useLingui()

  const { asset } = useAsset()
  const { switchChain } = useSwitchChain()
  const { networksList } = useNetworkMetadata()

  const ddoNetworkId = asset.credentialSubject?.chainId
  const ddoNetworkData = getNetworkDataById(networksList, ddoNetworkId)

  const { isSupported, isDfns, isSignerServer, reason } =
    useIsChainSupportedByConnector(ddoNetworkId)
  const isManagedSignerBlocked = (isDfns || isSignerServer) && !isSupported

  const handleSwitchChain = () => {
    if (!ddoNetworkId || isManagedSignerBlocked) return
    switchChain({ chainId: ddoNetworkId })
  }

  return (
    <div className={styles.networkWarning}>
      <Tooltip
        content={
          isManagedSignerBlocked
            ? reason
            : i18n._(
                'Click to switch your wallet to {value0} network to interact with this asset.',
                { value0: getNetworkDisplayName(ddoNetworkData) }
              )
        }
      >
        <Button
          style="gradient"
          onClick={handleSwitchChain}
          disabled={isManagedSignerBlocked}
          title={isManagedSignerBlocked ? reason : undefined}
        >
          {isManagedSignerBlocked
            ? isSignerServer
              ? i18n._('Unavailable on Signer Server')
              : i18n._('Unavailable on DFNS')
            : i18n._('Switch Network')}
        </Button>
      </Tooltip>
    </div>
  )
}
