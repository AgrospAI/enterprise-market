/** The header's wallet menu, where the user picks how to connect. */
export function openWalletMenu(): void {
  window.scrollTo({ top: 0 })
  document
    .querySelector<HTMLButtonElement>('header button[aria-label="Wallet menu"]')
    ?.click()
}
