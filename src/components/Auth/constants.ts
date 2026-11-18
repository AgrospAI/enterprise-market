import { i18n } from '../../i18n/index'
import type { BrandPanelIconVariant } from './AuthLayout/BrandPanelArtwork'

export type AuthTab = 'login' | 'signup'

export interface AuthFeature {
  icon: BrandPanelIconVariant
  text: string
}

export interface AuthPanelContent {
  title: string
  description: string
  features?: AuthFeature[]
}

export const OIDC_LOGOUT_PENDING_KEY = 'oidc_logout_pending'
export const OIDC_LOGOUT_RETURN_FALLBACK_MS = 1500

export const authTabLabels: Record<AuthTab, string> = {
  get login() {
    return i18n._('Sign in')
  },
  get signup() {
    return i18n._('Create account')
  }
}

export const authBrandDefaults: {
  title: string
  description: string
  features: AuthFeature[]
  trustLabel: string
  trustBadges: string[]
} = {
  get title() {
    return i18n._('Tareando Portal')
  },
  get description() {
    return i18n._(
      'Discover, publish and manage data, software and AI services with enterprise-grade governance and trusted access control.'
    )
  },
  features: [
    {
      icon: 'marketplace',
      get text() {
        return i18n._('Publish and discover service offerings')
      }
    },
    {
      icon: 'access',
      get text() {
        return i18n._('Control access with verified credentials')
      }
    },
    {
      icon: 'interop',
      get text() {
        return i18n._('Standardized, interoperable metadata')
      }
    },
    {
      icon: 'compute',
      get text() {
        return i18n._('Private computation with Compute-to-Data')
      }
    }
  ],
  get trustLabel() {
    return i18n._('Built for trusted data exchange')
  },
  get trustBadges() {
    return [
      i18n._('SSI Verification'),
      i18n._('Gaia-X Aligned'),
      'Compute-to-Data'
    ]
  }
}

export const authLoginCopy = {
  get title() {
    return i18n._('Welcome back')
  },
  get subtitle() {
    return i18n._("Sign in to your organization's data marketplace")
  },
  get ssoLabel() {
    return i18n._('Log in to OE Marketplace')
  },
  get ssoLoadingLabel() {
    return i18n._('Redirecting to login...')
  }
}

export const authSignupCopy = {
  get title() {
    return i18n._('Get started')
  },
  get subtitle() {
    return i18n._("Create your organization's marketplace account")
  },
  get ssoLabel() {
    return i18n._('Sign-up to OE Marketplace')
  },
  get ssoLoadingLabel() {
    return i18n._('Redirecting to signup...')
  },
  get termsIntro() {
    return i18n._('By creating an account, you agree to our')
  },
  get termsLabel() {
    return i18n._('Terms of Service')
  },
  get privacyLabel() {
    return i18n._('Privacy Policy')
  }
}

export const authSetupCopy = {
  get title() {
    return i18n._('One more step to enter the marketplace')
  },
  get subtitle() {
    return i18n._('Connect your wallet and SSI to finish secure access setup.')
  },
  get walletOnlySubtitle() {
    return i18n._('Connect your wallet to finish secure access setup.')
  },
  get greeting() {
    return i18n._('Welcome back')
  },
  get signupGreeting() {
    return i18n._('Welcome')
  },
  get signupSubtitle() {
    return i18n._(
      'Connect your wallet and SSI to finish setting up secure access.'
    )
  },
  get signupWalletOnlySubtitle() {
    return i18n._('Connect your wallet to finish setting up secure access.')
  },
  get ssoStep() {
    return i18n._('Company SSO')
  },
  get ssoMeta() {
    return i18n._('Company sign-in complete')
  },
  get walletStep() {
    return i18n._('Connect your Web3 wallet')
  },
  get walletPending() {
    return i18n._('Connect your Web3 wallet to continue')
  },
  get walletActive() {
    return i18n._('Connect your Web3 wallet to continue')
  },
  get walletComplete() {
    return i18n._('Wallet connected')
  },
  get ssiStep() {
    return i18n._('Establish SSI session')
  },
  get ssiPending() {
    return i18n._('Connect your wallet first to unlock SSI setup')
  },
  get ssiNetwork() {
    return i18n._('Switch to an SSI-supported network to continue')
  },
  get ssiActive() {
    return i18n._('Connect your SSI wallet to finish secure access')
  },
  get ssiConnecting() {
    return i18n._('Confirm the SSI request in your wallet')
  },
  get ssiComplete() {
    return i18n._('SSI session established')
  },
  get connectWallet() {
    return i18n._('Connect wallet')
  },
  get connectBrowserWallet() {
    return i18n._('Connect with Metamask')
  },
  get connectDfnsWallet() {
    return i18n._('Connect with Smart Account')
  },
  get connectSignerServer() {
    return i18n._('Connect to Signer Server')
  },
  get connectJsonWallet() {
    return i18n._('Connect with Wallet File')
  },
  get dfnsConnecting() {
    return i18n._('Connecting Dfns...')
  },
  get signerServerConnecting() {
    return i18n._('Connecting Signer Server...')
  },
  get connectSsi() {
    return i18n._('Connect SSI wallet')
  },
  get connectingSsi() {
    return i18n._('Connecting SSI...')
  },
  get switchNetwork() {
    return i18n._('Switch network')
  },
  get redirecting() {
    return i18n._('Access ready. Redirecting you now...')
  },
  get wrongAccount() {
    return i18n._('Signed in with a different company account?')
  },
  get wrongAccountAction() {
    return i18n._('Use another account')
  }
}

export const authLogoutCopy = {
  get title() {
    return i18n._('Logging you out')
  },
  get subtitle() {
    return i18n._('Redirecting to Authentik to confirm sign out')
  },
  get waiting() {
    return i18n._('Please wait a moment')
  }
}
