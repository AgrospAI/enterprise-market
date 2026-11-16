import { useLingui } from '@lingui/react'
import { useState } from 'react'
import { useUserPreferences } from '@context/UserPreferences'
import { STORAGE_KEY } from '@utils/wallet/ssiWallet'
import appConfig from 'app.config.cjs'
import SsiApiModal from '../Wallet/SsiApiModal'
import useSsiAutoConnectPrompt from '@hooks/useSsiAutoConnectPrompt'
import useSsiConnect from '@hooks/useSsiConnect'

export default function SsiWalletManager() {
  useLingui()

  const { showSsiWalletModule, setShowSsiWalletModule } = useUserPreferences()
  useSsiAutoConnectPrompt()
  const { connectSsi } = useSsiConnect()

  const [overrideApi, setOverrideApi] = useState(() => {
    return sessionStorage.getItem(STORAGE_KEY) || appConfig.ssiWalletApi
  })

  async function handleSsiConnect() {
    await connectSsi({ apiOverride: overrideApi })
  }

  function handleClose() {
    setShowSsiWalletModule(false)
  }

  return showSsiWalletModule ? (
    <SsiApiModal
      apiValue={overrideApi}
      onChange={setOverrideApi}
      onConnect={handleSsiConnect}
      onClose={handleClose}
    />
  ) : null
}
