import { i18n } from '../i18n/index'
import { useCallback } from 'react'
import { LoggerInstance } from '@oceanprotocol/lib'
import { toast } from 'react-toastify'
import { useEthersSigner } from '@hooks/useEthersSigner'
import { useSsiWallet } from '@context/SsiWallet'
import { useUserPreferences } from '@context/UserPreferences'
import {
  connectToWallet,
  getWalletKeys,
  getWallets,
  setSsiWalletApiOverride
} from '@utils/wallet/ssiWallet'
import { SsiWalletDesc, SsiWalletSession } from 'src/@types/SsiWallet'

interface ConnectSsiOptions {
  apiOverride?: string
}

export default function useSsiConnect() {
  const walletClient = useEthersSigner()
  const { setShowSsiWalletModule } = useUserPreferences()
  const {
    setSessionToken,
    ssiWalletCache,
    setCachedCredentials,
    clearVerifierSessionCache,
    setIsSsiSessionHydrating,
    selectedWallet,
    setSelectedWallet,
    setSelectedKey,
    setSelectedDid
  } = useSsiWallet()

  const fetchWallets = useCallback(
    async (session: SsiWalletSession) => {
      try {
        if (!session) return selectedWallet
        const wallets = await getWallets(session.token)
        setSelectedWallet(wallets[0])
        return wallets[0]
      } catch (error) {
        LoggerInstance.error(error)
        return selectedWallet
      }
    },
    [selectedWallet, setSelectedWallet]
  )

  const fetchKeys = useCallback(
    async (wallet: SsiWalletDesc, session: SsiWalletSession) => {
      if (!wallet || !session) return
      try {
        const keys = await getWalletKeys(wallet, session.token)
        setSelectedKey(keys[0])
      } catch (error) {
        LoggerInstance.error(error)
      }
    },
    [setSelectedKey]
  )

  const connectSsi = useCallback(
    async ({ apiOverride }: ConnectSsiOptions = {}): Promise<boolean> => {
      setIsSsiSessionHydrating(true)

      try {
        if (!walletClient) {
          toast.error(i18n._('Connect your wallet before starting SSI setup.'))
          return false
        }

        ssiWalletCache.clearCredentials()
        setCachedCredentials([])
        clearVerifierSessionCache()

        if (apiOverride) {
          setSsiWalletApiOverride(apiOverride)
        }

        const session = await connectToWallet(walletClient)
        setSessionToken(session)
        setSelectedDid(undefined)
        setSelectedKey(undefined)
        const wallet = await fetchWallets(session)
        await fetchKeys(wallet, session)
        setShowSsiWalletModule(false)
        return true
      } catch (error) {
        LoggerInstance.error(error)
        const message =
          error instanceof Error
            ? error.message
            : i18n._('SSI connection failed')
        toast.error(i18n._(message))
        return false
      } finally {
        setIsSsiSessionHydrating(false)
      }
    },
    [
      walletClient,
      ssiWalletCache,
      setCachedCredentials,
      clearVerifierSessionCache,
      setSessionToken,
      setSelectedDid,
      setSelectedKey,
      fetchWallets,
      fetchKeys,
      setShowSsiWalletModule,
      setIsSsiSessionHydrating,
      i18n.locale
    ]
  )

  return { connectSsi }
}
