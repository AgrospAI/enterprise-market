import { useLingui } from '@lingui/react'
import { useState } from 'react'
import { useAuth } from '@hooks/useAuth'
import { authConfig } from '../../../config/auth.config'
import { authLoginCopy } from '../constants'
import { SsoIcon } from '../SsoIcons'
import styles from './LoginForm.module.css'

export default function LoginForm() {
  useLingui()

  const { beginOidcFlow } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleOIDCLogin = async () => {
    setIsSubmitting(true)
    try {
      await beginOidcFlow('login')
    } catch {
      setIsSubmitting(false)
    }
  }

  const showOIDC = authConfig.oidc.issuer && authConfig.oidc.clientId

  return (
    <div>
      <div className={styles.formHeader}>
        <h2 className={styles.title}>{authLoginCopy.title}</h2>
        <p className={styles.subtitle}>{authLoginCopy.subtitle}</p>
      </div>

      <div className={styles.socialButtons}>
        {showOIDC && (
          <button
            type="button"
            onClick={handleOIDCLogin}
            className={`${styles.socialButton} ${
              isSubmitting ? styles.loading : ''
            }`}
          >
            <span className={styles.buttonContent}>
              <SsoIcon variant="building_key" className={styles.icon} />
              <span>
                {isSubmitting
                  ? authLoginCopy.ssoLoadingLabel
                  : authLoginCopy.ssoLabel}
              </span>
            </span>
          </button>
        )}
      </div>
    </div>
  )
}
