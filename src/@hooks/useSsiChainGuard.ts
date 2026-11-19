import { i18n } from '../i18n/index'
import { useCallback } from 'react'
import { LoggerInstance } from '@oceanprotocol/lib'
import { toast } from 'react-toastify'
import useSsiAllowedChain from './useSsiAllowedChain'
import useNetworkMetadata from './useNetworkMetadata'

export default function useSsiChainGuard() {
  const { chainId, isSsiChainAllowed, isSsiChainReady } = useSsiAllowedChain()
  const { networkDisplayName } = useNetworkMetadata(chainId)

  const getUnsupportedChainMessage = useCallback(() => {
    const networkName =
      networkDisplayName ||
      (chainId ? i18n._('Chain ID {chainId}', { chainId }) : i18n._('Unknown'))
    return i18n._(
      'Blockchain {networkName} not supported. SSI signature cannot be initiated on this network.',
      { networkName }
    )
  }, [networkDisplayName, chainId, i18n.locale])

  const ensureAllowedChainForSsi = useCallback((): boolean => {
    if (!isSsiChainReady) {
      toast.info(
        i18n._('Checking network support. Please try again in a moment.')
      )
      return false
    }

    if (isSsiChainAllowed) return true

    const message = getUnsupportedChainMessage()
    LoggerInstance.error(message)
    toast.error(i18n._(message))
    return false
  }, [
    isSsiChainAllowed,
    isSsiChainReady,
    getUnsupportedChainMessage,
    i18n.locale
  ])

  return {
    isAllowedChain: isSsiChainAllowed,
    ensureAllowedChainForSsi
  }
}
