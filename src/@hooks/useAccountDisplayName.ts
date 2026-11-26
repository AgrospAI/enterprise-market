import { useLingui } from '@lingui/react'
import { useAccount } from 'wagmi'

/** Mark names belonging to the connected wallet consistently across the UI. */
export function useAccountDisplayName(account: string, name: string): string {
  const { i18n } = useLingui()
  const { address } = useAccount()
  const isOwnAccount =
    Boolean(account && address) &&
    account.toLowerCase() === address.toLowerCase()

  return isOwnAccount ? `${name} ${i18n._('(you)')}` : name
}
