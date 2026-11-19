import { i18n } from '../../i18n/index'
import { useLingui } from '@lingui/react'
import { MouseEventHandler, ReactElement, ReactNode } from 'react'
import Link from 'next/link'
import { useAuth } from '@hooks/useAuth'
import { useRouter } from 'next/router'

interface AuthEntryProps {
  authenticatedContent: ReactNode
  loginClassName: string
  buttonContentClassName: string
  buttonTextClassName: string
  loginLabel?: string
  onLoginClick?: MouseEventHandler<HTMLButtonElement>
}

export default function AuthEntry({
  authenticatedContent,
  loginClassName,
  buttonContentClassName,
  buttonTextClassName,
  loginLabel = i18n._('Login'),
  onLoginClick
}: AuthEntryProps): ReactElement {
  useLingui()

  const { isAuthenticated, authEnabled } = useAuth()
  const router = useRouter()

  const path = router.asPath.split('?')[0]
  const isAuthRoute = authEnabled && path.startsWith('/auth/')

  if (!authEnabled) {
    return <>{authenticatedContent}</>
  }

  if (isAuthRoute) {
    return <></>
  }

  if (isAuthenticated) {
    return <>{authenticatedContent}</>
  }

  const content = (
    <span className={buttonContentClassName}>
      <span className={buttonTextClassName}>{loginLabel}</span>
    </span>
  )

  if (onLoginClick) {
    return (
      <button type="button" className={loginClassName} onClick={onLoginClick}>
        {content}
      </button>
    )
  }

  return (
    <Link className={loginClassName} href="/auth/login">
      {content}
    </Link>
  )
}
