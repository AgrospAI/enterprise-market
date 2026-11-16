import { useLingui } from '@lingui/react'
import { useEffect, ReactNode, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth, verifyAuthSessionDetailed } from '@hooks/useAuth'
import Loader from '@shared/atoms/Loader'

interface AuthGuardProps {
  children: ReactNode
}

export default function AuthGuard({ children }: AuthGuardProps) {
  useLingui()

  const { isAuthenticated, isLoading, authEnabled, clearLocalSession } =
    useAuth()
  const router = useRouter()
  const [isRouteSessionChecking, setIsRouteSessionChecking] = useState(false)

  const isPublicRoute = (): boolean => {
    const path = router.asPath.split('?')[0]

    const exactPublicPaths = [
      '/',
      '/auth/login',
      '/auth/callback',
      '/about',
      '/privacy'
    ]

    if (exactPublicPaths.includes(path)) {
      return true
    }

    if (path.startsWith('/privacy/')) {
      return true
    }

    if (path.startsWith('/auth/')) {
      return true
    }

    return false
  }

  const isPublic = isPublicRoute()
  const shouldRedirectToLogin =
    authEnabled && !isLoading && !isAuthenticated && !isPublic

  useEffect(() => {
    if (!router.isReady) return
    if (!authEnabled || isPublic || !isAuthenticated) return

    let cancelled = false

    const verifyRouteSession = async () => {
      setIsRouteSessionChecking(true)
      try {
        const result = await verifyAuthSessionDetailed()
        if (cancelled) return

        if (!result.user) {
          clearLocalSession('/api/auth/logout')
        }
      } catch (error) {
        console.error('Route session verification failed:', error)
      } finally {
        if (!cancelled) setIsRouteSessionChecking(false)
      }
    }

    verifyRouteSession()

    return () => {
      cancelled = true
    }
  }, [
    authEnabled,
    clearLocalSession,
    isAuthenticated,
    isPublic,
    router.pathname,
    router.isReady
  ])

  useEffect(() => {
    if (shouldRedirectToLogin) {
      router.replace(
        `/auth/login?callbackUrl=${encodeURIComponent(router.asPath)}`
      )
    }
  }, [router, router.asPath, shouldRedirectToLogin])

  if (!authEnabled) {
    return <>{children}</>
  }

  if (
    (isLoading && !isPublic) ||
    isRouteSessionChecking ||
    shouldRedirectToLogin
  ) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Loader variant="primary" noMargin />
      </div>
    )
  }

  return <>{children}</>
}
