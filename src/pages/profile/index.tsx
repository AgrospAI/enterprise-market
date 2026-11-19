import { useLingui } from '@lingui/react'
import { i18n } from '../../i18n/index'
import { ReactElement, useEffect, useState } from 'react'
import Page from '@shared/Page'
import ProfilePage from '../../components/Profile'
import ProfileProvider from '@context/Profile'
import { useRouter } from 'next/router'
import { useAccount } from 'wagmi'
import { isAddress } from 'ethers'
import { contentPagesProfile as content } from '../../i18n/content'

export default function PageProfile(): ReactElement {
  useLingui()

  const router = useRouter()
  const { address: accountId, isConnecting, isReconnecting } = useAccount()
  const [finalAccountId, setFinalAccountId] = useState<string>()
  const [ownAccount, setOwnAccount] = useState(false)

  useEffect(() => {
    if (!router.isReady) return
    if (isConnecting || isReconnecting) return
    if (accountId) return

    router.replace(
      `/auth/login?callbackUrl=${encodeURIComponent(router.asPath)}`
    )
  }, [accountId, isConnecting, isReconnecting, router])

  // Have accountId in path take over, if not present fall back to web3
  useEffect(() => {
    async function init() {
      if (!router?.route) return

      // Path is root /profile, have web3 take over
      if (router.route === '/profile') {
        setFinalAccountId(accountId)
        setOwnAccount(true)
        return
      }

      const pathAccount = router.query.account as string

      // Path has ETH address
      if (isAddress(pathAccount)) {
        setOwnAccount(pathAccount === accountId)
        const finalAccountId = pathAccount || accountId
        setFinalAccountId(finalAccountId)
      }
    }
    init()
  }, [router, accountId])

  if (!accountId || !finalAccountId) {
    return null
  }

  return (
    <Page
      uri={router.route}
      title={ownAccount ? i18n._('My Profile') : content.title}
      description={content.description}
      noPageHeader
    >
      <ProfileProvider accountId={finalAccountId} ownAccount={ownAccount}>
        <ProfilePage accountId={finalAccountId} />
      </ProfileProvider>
    </Page>
  )
}
