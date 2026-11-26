import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Page } from 'playwright'
import { getAddress } from 'ethers'

/** Import through the production UI; no injected accounts, mocks or saved keys. */
export async function signIn(page: Page, path = '/') {
  const walletFile = process.env.E2E_WALLET_FILE
  const password = process.env.E2E_WALLET_PASSWORD
  if (!walletFile || !password) {
    throw new Error('Set E2E_WALLET_FILE and E2E_WALLET_PASSWORD.')
  }
  const json = JSON.parse(await readFile(resolve(walletFile), 'utf8'))
  const address = getAddress(`0x${String(json.address).replace(/^0x/, '')}`)
  await page.goto(path)
  await page.locator('[name="language"]').selectOption('en')
  const config = await page.evaluate(() => window.__RUNTIME_CONFIG__ || {})
  if (config.NEXT_PUBLIC_SSI_ENABLED === 'true') {
    throw new Error(
      'This portal requires an SSI signing session. Wallet-only E2E requires a portal configured with NEXT_PUBLIC_SSI_ENABLED=false; the tests never bypass SSI authentication.'
    )
  }
  const account = page.getByRole('button', { name: 'Account', exact: true })
  const walletMenu = page.getByRole('button', {
    name: 'Wallet menu',
    exact: true
  })
  await account.or(walletMenu).waitFor()
  // Hydration can briefly display the disconnected menu while wagmi reconnects.
  await account.waitFor({ timeout: 3000 }).catch(() => undefined)
  if (await account.isVisible()) {
    const connectedAddress = await account
      .locator('span[title]')
      .getAttribute('title')
    if (connectedAddress?.toLowerCase() !== address.toLowerCase()) {
      throw new Error('The connected wallet does not match E2E_WALLET_FILE.')
    }
    return address.toLowerCase()
  }
  await walletMenu.click()
  await page.getByRole('button', { name: /Connect web3 wallet/ }).click()
  await page.getByRole('button', { name: 'Connect with Wallet File' }).click()
  const dialog = page.getByRole('dialog', {
    name: /^(Import|Unlock) JSON Wallet$/
  })
  if (await dialog.locator('input[type=file]').count()) {
    await dialog.locator('input[type=file]').setInputFiles(resolve(walletFile))
  }
  await dialog.getByLabel('Password', { exact: true }).fill(password)
  await dialog
    .getByRole('button', { name: /^(Decrypt & Connect|Unlock)$/ })
    .click()
  await dialog.waitFor({ state: 'hidden', timeout: 60_000 })
  await account.waitFor()
  return address.toLowerCase()
}
