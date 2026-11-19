import { Trans, useLingui } from '@lingui/react'
import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@hooks/useAuth'
import { authConfig } from '../../../config/auth.config'
import { authSignupCopy } from '../constants'
import { SsoIcon } from '../SsoIcons'
import styles from './SignupForm.module.css'

export default function SignupForm() {
  useLingui()

  const { beginOidcFlow } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleOIDCSignup = async () => {
    setIsSubmitting(true)
    try {
      await beginOidcFlow('signup')
    } catch {
      setIsSubmitting(false)
    }
  }

  const showOIDC = authConfig.oidc.issuer && authConfig.oidc.clientId

  return (
    <div>
      <div className={styles.formHeader}>
        <h2 className={styles.title}>{authSignupCopy.title}</h2>
        <p className={styles.subtitle}>{authSignupCopy.subtitle}</p>
      </div>

      <div className={styles.socialButtons}>
        {showOIDC && (
          <button
            type="button"
            onClick={handleOIDCSignup}
            className={`${styles.socialButton} ${
              isSubmitting ? styles.loading : ''
            }`}
          >
            <span className={styles.buttonContent}>
              <SsoIcon variant="user_plus" className={styles.icon} />
              <span>
                {isSubmitting
                  ? authSignupCopy.ssoLoadingLabel
                  : authSignupCopy.ssoLabel}
              </span>
            </span>
          </button>
        )}
      </div>

      <div className={styles.terms}>
        <Trans
          id="By creating an account, you agree to our <0>Terms of Service</0> and <1>Privacy Policy</1>"
          components={{
            0: <Link href="/privacy/terms" />,
            1: <Link href="/privacy/privacy-policy" />
          }}
        />
      </div>
    </div>
  )
}
