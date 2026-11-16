import { useLingui } from '@lingui/react'
import { ReactElement } from 'react'
import HistoryPage from './History'
import AccountHeader from './Header'

export default function AccountPage({
  accountId
}: {
  accountId: string
}): ReactElement {
  useLingui()

  return (
    <>
      <AccountHeader accountId={accountId} />
      <HistoryPage accountIdentifier={accountId} />
    </>
  )
}
