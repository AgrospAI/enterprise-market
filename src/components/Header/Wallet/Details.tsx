import NotificationBadge from '@components/AccessRequests/NotificationBadge'
import { Trans, useLingui } from '@lingui/react'
import { i18n } from '../../../i18n/index'
import { ReactElement, ReactNode, useState } from 'react'
import { useDisconnect, useAccount, useSwitchChain } from 'wagmi'
import styles from './Details.module.css'
import Avatar from '@components/@shared/atoms/Avatar'
import Bookmark from '@images/bookmark.svg'
import Mail from '@images/mail.svg'
import DisconnectWallet from '@images/disconnect.svg'
import LogoutIcon from '@images/logout.svg'
import Copy from '@shared/atoms/Copy'
import AddTokenList from './AddTokenList'
import { useSsiWallet } from '@context/SsiWallet'
import { disconnectFromWallet } from '@utils/wallet/ssiWallet'
import { LoggerInstance } from '@oceanprotocol/lib'
import { useAuth } from '@hooks/useAuth'
import { useRouter } from 'next/router'
import { useUserPreferences } from '@context/UserPreferences'
import { clearFederatedStorage } from '@utils/logoutRouter'
import { JSON_WALLET_CONNECTOR_ID } from '@utils/wallet/jsonWalletConnector'
import { clearEncryptedWalletJson } from '@utils/wallet/jsonWalletStorage'
import { toast } from 'react-toastify'
import NetworkName from '@shared/NetworkName'

interface DetailsProps {
  onRequestClose?: () => void
  onRequestWalletChoice?: () => void
}

function formatWalletAddress(address: string): string {
  if (!address) return ''
  return `${address.slice(0, 8)}...${address.slice(-4)}`
}

interface MenuRowProps {
  icon: ReactNode
  label: ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
}

function MenuRow({
  icon,
  label,
  onClick,
  disabled = false,
  className
}: MenuRowProps): ReactElement {
  useLingui()

  return (
    <button
      type="button"
      className={`${styles.menuRow} ${disabled ? styles.menuRowDisabled : ''} ${
        className || ''
      }`}
      onClick={() => {
        if (disabled) return
        onClick?.()
      }}
      disabled={disabled}
    >
      <span className={styles.menuRowIcon}>{icon}</span>
      <span className={styles.menuRowLabel}>{label}</span>
    </button>
  )
}

interface ActionButtonProps {
  icon: ReactNode
  title: string
  description?: string
  onClick: () => void
  tone?: 'default' | 'danger'
  isLoading?: boolean
}

function ActionButton({
  icon,
  title,
  description,
  onClick,
  tone = 'default',
  isLoading = false
}: ActionButtonProps): ReactElement {
  useLingui()

  const isDanger = tone === 'danger'
  const hasDescription = Boolean(description)

  return (
    <button
      type="button"
      className={`${styles.actionButton} ${
        isDanger ? styles.actionButtonDanger : ''
      } ${!hasDescription ? styles.actionButtonCompact : ''}`}
      onClick={onClick}
      disabled={isLoading}
    >
      <span
        className={`${styles.actionIconBadge} ${
          isDanger ? styles.actionIconBadgeDanger : ''
        }`}
        aria-hidden="true"
      >
        {isLoading ? <span className={styles.spinner} /> : icon}
      </span>
      <span className={styles.actionContent}>
        <span className={styles.actionTitle}>{title}</span>
        {description && (
          <span className={styles.actionDescription}>{description}</span>
        )}
      </span>
    </button>
  )
}

export default function Details({
  onRequestClose,
  onRequestWalletChoice
}: DetailsProps): ReactElement {
  useLingui()

  const {
    connector: activeConnector,
    address: accountId,
    chainId: connectedChainId
  } = useAccount()
  const { disconnect } = useDisconnect()
  const { logout, markLogoutPending, isAuthenticated, user, authEnabled } =
    useAuth()
  const router = useRouter()
  const { showOnboardingModule } = useUserPreferences()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const { chains, switchChain } = useSwitchChain()

  const isJsonWallet = activeConnector?.id === JSON_WALLET_CONNECTOR_ID

  const {
    setSessionToken,
    ssiWalletCache,
    setCachedCredentials,
    clearVerifierSessionCache
  } = useSsiWallet()

  async function disconnectSsiWallet() {
    try {
      ssiWalletCache.clearCredentials()
      setCachedCredentials([])
      clearVerifierSessionCache()
      disconnectFromWallet()
      setSessionToken(undefined)
    } catch (error) {
      LoggerInstance.error(error)
    }
  }

  const isWalletConnected = Boolean(accountId)
  const hasMarketplaceSession = authEnabled && isAuthenticated && Boolean(user)
  const walletLabel =
    activeConnector?.name || i18n._('Web3 wallet disconnected')
  const walletDescription = isWalletConnected
    ? formatWalletAddress(accountId)
    : i18n._('Connect your web3 wallet to restore marketplace actions')
  const showTokenList =
    isWalletConnected && activeConnector?.name === 'MetaMask'
  const showActionDescriptions = showOnboardingModule

  const handleNavigation = async (href: string) => {
    onRequestClose?.()
    await router.push(href)
  }

  const handleConnectWallet = () => {
    onRequestClose?.()
    onRequestWalletChoice?.()
  }

  const handleDisconnectWallet = async () => {
    disconnect()
    // eslint-disable-next-line promise/param-names
    await new Promise((r) => setTimeout(r, 500))
    await disconnectSsiWallet()
  }

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    markLogoutPending()

    try {
      if (isWalletConnected) {
        await handleDisconnectWallet()
      } else {
        await disconnectSsiWallet()
      }
    } catch (error) {
      console.error('wallet logout error', error)
    }

    clearFederatedStorage()
    await logout()
    onRequestClose?.()
    setIsLoggingOut(false)
  }

  return (
    <div className={styles.details}>
      <div className={styles.section}>
        <MenuRow
          icon={
            accountId ? (
              <Avatar accountId={accountId} />
            ) : (
              <span className={styles.placeholderAvatar} aria-hidden="true" />
            )
          }
          label={i18n._('View Profile')}
          onClick={() => handleNavigation('/profile')}
          disabled={!isWalletConnected}
        />
        <MenuRow
          icon={<Bookmark />}
          label={i18n._('View Bookmarks')}
          onClick={() => handleNavigation('/bookmarks')}
          disabled={!isWalletConnected}
          className={styles.bookmarksRow}
        />
        <MenuRow
          icon={<Mail />}
          label={
            <>
              {i18n._('View Access Requests')} <NotificationBadge />
            </>
          }
          onClick={() => handleNavigation('/profile?defaultTab=accessRequests')}
          disabled={!isWalletConnected}
          className={styles.accessRequestsRow}
        />
      </div>

      <div className={styles.section}>
        <div className={styles.walletInfo}>
          <div className={styles.walletHeading}>{walletLabel}</div>
          {isWalletConnected ? (
            <div className={styles.walletAddressRow}>
              <span className={styles.walletDescription} title={accountId}>
                {walletDescription}
              </span>
              <Copy text={accountId} />
            </div>
          ) : (
            <div className={styles.walletDescription}>{walletDescription}</div>
          )}
          {showTokenList && <AddTokenList disabled={!isWalletConnected} />}
        </div>

        {isJsonWallet && isWalletConnected && chains.length > 0 && (
          <div className={styles.chainSwitcher}>
            <span className={styles.chainSwitcherLabel}>
              <Trans id="Switch Network" />
            </span>
            <div className={styles.chainList}>
              {chains.map((chain) => (
                <button
                  key={chain.id}
                  type="button"
                  className={`${styles.chainItem} ${
                    chain.id === connectedChainId ? styles.chainItemActive : ''
                  }`}
                  disabled={chain.id === connectedChainId}
                  onClick={() =>
                    switchChain(
                      { chainId: chain.id },
                      {
                        onSuccess: (data) =>
                          toast.success(
                            i18n._('Switched to {value0}', {
                              value0: data.name
                            })
                          ),
                        onError: (err) =>
                          toast.error(
                            i18n._('Failed to switch network: {value0}', {
                              value0: err.message
                            })
                          )
                      }
                    )
                  }
                >
                  <NetworkName networkId={chain.id} minimal />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={styles.section}>
        <ActionButton
          icon={<DisconnectWallet className={styles.actionGlyph} />}
          title={
            isWalletConnected
              ? i18n._('Disconnect web3 wallet')
              : i18n._('Connect web3 wallet')
          }
          description={
            showActionDescriptions
              ? isWalletConnected
                ? i18n._(
                    'Stop the active wallet connection for this browser session.'
                  )
                : i18n._(
                    'Reconnect your wallet to restore web3 actions in the marketplace.'
                  )
              : undefined
          }
          onClick={
            isWalletConnected ? handleDisconnectWallet : handleConnectWallet
          }
        />

        {isJsonWallet && isWalletConnected && (
          <ActionButton
            icon={<DisconnectWallet className={styles.actionGlyph} />}
            title={i18n._('Remove JSON wallet')}
            description={
              showActionDescriptions
                ? i18n._('Remove the stored wallet file and disconnect.')
                : undefined
            }
            onClick={() => {
              disconnect()
              clearEncryptedWalletJson()
              toast.info(i18n._('Wallet removed.'))
            }}
            tone="danger"
          />
        )}

        {hasMarketplaceSession && (
          <ActionButton
            icon={<LogoutIcon className={styles.actionGlyph} />}
            title={i18n._('Sign out of marketplace')}
            description={
              showActionDescriptions
                ? isWalletConnected
                  ? i18n._(
                      'End your marketplace session and disconnect this linked wallet.'
                    )
                  : i18n._('End your marketplace session on this browser.')
                : undefined
            }
            onClick={handleLogout}
            tone="danger"
            isLoading={isLoggingOut}
          />
        )}
      </div>

      {hasMarketplaceSession && user && (
        <div className={styles.userInfo}>
          <div className={styles.userEmail}>{user.email}</div>
          <div className={styles.userProvider}>
            <Trans
              id="Signed in with {provider}"
              values={{ provider: user.authProvider }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
