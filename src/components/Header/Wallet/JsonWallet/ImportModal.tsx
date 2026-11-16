import { translate } from '../../../../i18n/translate'
import { Trans, useLingui } from '@lingui/react'
import { i18n } from '../../../../i18n/index'
import { ReactElement, useCallback, useRef, useState } from 'react'
import Modal from '@shared/atoms/Modal'
import Button from '@shared/atoms/Button'
import {
  decryptJsonWallet,
  getAddressFromJsonWallet,
  isValidEncryptedWalletJson
} from '@utils/wallet/jsonWalletUtils'
import {
  JSON_WALLET_CONNECTOR_ID,
  JsonWalletConnectorProperties
} from '@utils/wallet/jsonWalletConnector'
import { useAccount, useChains, useConnect, useConnectors } from 'wagmi'
import { useEncryptedWalletJson } from '@utils/wallet/jsonWalletStorage'
import { toast } from 'react-toastify'
import { LoggerInstance } from '@oceanprotocol/lib'
import { accountTruncate } from '@utils/wallet'
import styles from './ImportModal.module.css'

interface ImportModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ImportModal({
  isOpen,
  onClose
}: ImportModalProps): ReactElement {
  useLingui()

  const connectors = useConnectors()
  const { connectAsync } = useConnect()
  const { chain } = useAccount()
  const chains = useChains()
  const [encryptedWalletJson, setEncryptedWalletJson] = useEncryptedWalletJson()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [rawJson, setRawJson] = useState<string>('')
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [isDecrypting, setIsDecrypting] = useState(false)
  const [decryptProgress, setDecryptProgress] = useState(0)
  const [error, setError] = useState('')

  // Determine if we already have a stored wallet to unlock
  const storedAddress = encryptedWalletJson
    ? getAddressFromJsonWallet(encryptedWalletJson)
    : null
  const isUnlockMode = !!storedAddress && !rawJson

  // Show password step when we have a file OR a stored wallet
  const showPasswordStep = !!walletAddress || isUnlockMode

  const reset = useCallback(() => {
    setRawJson('')
    setWalletAddress(null)
    setPassword('')
    setIsDecrypting(false)
    setDecryptProgress(0)
    setError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const handleClose = useCallback(() => {
    reset()

    // Cancel any pending connect promise in the connector
    const connector = connectors.find((c) => c.id === JSON_WALLET_CONNECTOR_ID)
    if (connector) {
      ;(
        connector as unknown as JsonWalletConnectorProperties
      ).cancelPendingConnect()
    }

    onClose()
  }, [onClose, reset, connectors])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setError('')
      const file = e.target.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (event) => {
        const content = event.target?.result as string
        if (!isValidEncryptedWalletJson(content)) {
          setError(i18n._('Invalid encrypted wallet JSON file.'))
          return
        }
        const address = getAddressFromJsonWallet(content)
        if (!address) {
          setError(i18n._('Could not extract address from wallet file.'))
          return
        }
        setRawJson(content)
        setWalletAddress(address)
      }
      reader.readAsText(file)
    },
    [i18n.locale]
  )

  const handleDecrypt = useCallback(async () => {
    const jsonToDecrypt = rawJson || encryptedWalletJson
    if (!jsonToDecrypt || !password || isDecrypting) return

    setError('')
    setIsDecrypting(true)
    setDecryptProgress(0)

    const result = await decryptJsonWallet(jsonToDecrypt, password, (percent) =>
      setDecryptProgress(percent)
    )

    if (!result.success) {
      const failResult = result as { success: false; error: string }
      LoggerInstance.error('[ImportModal] Decryption failed:', failResult.error)
      setError(
        failResult.error.includes('incorrect password') ||
          failResult.error.includes('invalid password')
          ? i18n._('Incorrect password.')
          : i18n._('Failed to decrypt wallet file.')
      )
      setDecryptProgress(0)
      setIsDecrypting(false)
      return
    }

    try {
      const connector = connectors.find(
        (c) => c.id === JSON_WALLET_CONNECTOR_ID
      )
      if (!connector) {
        throw new Error('JSON Wallet connector not found.')
      }

      // Load the private key into the connector.
      ;(connector as unknown as JsonWalletConnectorProperties).loadWallet(
        result.privateKey
      )

      // Explicitly connect through wagmi to ensure all internal state
      // (including useConnectorClient) is properly initialized.
      let connectedChainId: number | undefined
      try {
        const result = await connectAsync({ connector })
        connectedChainId = result.chainId
      } catch {
        // May throw if already connected via pending resolver — that's fine
      }

      // Save encrypted JSON for future sessions (only for new imports)
      if (rawJson) {
        setEncryptedWalletJson(rawJson)
      }

      const displayAddress = walletAddress || storedAddress
      const connectedChain = chains.find(
        (c) => c.id === (connectedChainId ?? chain?.id)
      )
      const chainLabel = connectedChain
        ? i18n._(' on {value0}', { value0: connectedChain.name })
        : ''
      const truncated = accountTruncate(displayAddress || '')
      toast.success(
        i18n._('Wallet {truncated} connected{chainLabel}.', {
          truncated,
          chainLabel
        })
      )
      reset()
      onClose()
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : i18n._('Failed to connect wallet.')
      LoggerInstance.error('[ImportModal] Connect failed:', e)
      setError(message)
      setDecryptProgress(0)
      setIsDecrypting(false)
    }
  }, [
    rawJson,
    encryptedWalletJson,
    password,
    isDecrypting,
    connectors,
    connectAsync,
    setEncryptedWalletJson,
    walletAddress,
    storedAddress,
    reset,
    onClose,
    chain?.id,
    chains,
    i18n.locale
  ])

  const handleRemoveStored = useCallback(async () => {
    // Disconnect the connector to clear any session-resident private key
    const connector = connectors.find((c) => c.id === JSON_WALLET_CONNECTOR_ID)
    if (connector) {
      try {
        await (connector as any).disconnect?.()
      } catch {
        // ignore
      }
      ;(
        connector as unknown as JsonWalletConnectorProperties
      ).cancelPendingConnect()
    }

    setEncryptedWalletJson('')
    toast.info(i18n._('Stored wallet removed.'))
    reset()
    onClose()
  }, [setEncryptedWalletJson, connectors, reset, onClose, i18n.locale])

  return (
    <Modal
      title={
        isUnlockMode
          ? i18n._('Unlock JSON Wallet')
          : i18n._('Import JSON Wallet')
      }
      isOpen={isOpen}
      onToggleModal={handleClose}
      className={styles.importModal}
      overlayClassName={styles.importOverlay}
    >
      <div className={styles.step}>
        {!showPasswordStep ? (
          <>
            <button
              type="button"
              className={styles.uploadArea}
              onClick={() => fileInputRef.current?.click()}
            >
              <span className={styles.uploadLabel}>
                <Trans id="Click to select an encrypted JSON wallet file" />{' '}
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className={styles.fileInput}
              onChange={handleFileChange}
            />
          </>
        ) : (
          <>
            <div className={styles.addressPreview}>
              <strong>
                <Trans id="Wallet Address" />
              </strong>
              {walletAddress || storedAddress}
            </div>

            {isDecrypting ? (
              <div className={styles.progress}>
                <div className={styles.progressBar}>
                  <div
                    className={styles.progressFill}
                    style={{
                      width: `${Math.round(decryptProgress * 100)}%`
                    }}
                  />
                </div>
                <span className={styles.progressText}>
                  <Trans
                    id="Decrypting… {progress}%"
                    values={{ progress: Math.round(decryptProgress * 100) }}
                  />
                </span>
              </div>
            ) : (
              <>
                <div className={styles.passwordField}>
                  <label htmlFor="json-wallet-password">
                    <Trans id="Password" />
                  </label>
                  <input
                    id="json-wallet-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleDecrypt()
                    }}
                    placeholder={i18n._('Enter wallet password')}
                    autoFocus
                  />
                </div>

                <div className={styles.actions}>
                  {isUnlockMode ? (
                    <Button
                      style="text"
                      size="small"
                      onClick={handleRemoveStored}
                      type="button"
                    >
                      <Trans id="Remove Wallet" />{' '}
                    </Button>
                  ) : (
                    <Button
                      style="text"
                      size="small"
                      onClick={reset}
                      type="button"
                    >
                      <Trans id="Back" />{' '}
                    </Button>
                  )}
                  <Button
                    style="primary"
                    size="small"
                    onClick={handleDecrypt}
                    disabled={!password}
                    type="button"
                  >
                    {isUnlockMode
                      ? i18n._('Unlock')
                      : i18n._('Decrypt & Connect')}
                  </Button>
                </div>
              </>
            )}
          </>
        )}

        {error && <p className={styles.error}>{translate(error)}</p>}
      </div>
    </Modal>
  )
}
