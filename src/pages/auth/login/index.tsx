import { useLingui } from '@lingui/react'
import { i18n } from '../../../i18n/index'
import { ReactElement, useEffect } from 'react'
import router, { useRouter } from 'next/router'
import Login from '../../../components/Auth/Login'
import Page from '../../../components/@shared/Page'
import type { AuthFeature, AuthTab } from '../../../components/Auth/constants'
import { authConfig } from '../../../config/auth.config'
import { contentAuthLogin as content } from '../../../i18n/content'

export default function AuthLogin(): ReactElement {
  useLingui()

  const pageRouter = useRouter()
  const { title, description, features } = content
  const typedFeatures = features as AuthFeature[]
  const initialTab =
    pageRouter.query.tab === 'signup'
      ? ('signup' as AuthTab)
      : ('login' as AuthTab)

  useEffect(() => {
    if (!authConfig.enabled) {
      pageRouter.replace('/')
    }
  }, [pageRouter])

  if (!authConfig.enabled) return null

  return (
    <Page
      title={
        initialTab === 'signup' ? i18n._('Create account') : i18n._('Sign in')
      }
      description={description}
      uri={router.route}
      noPageHeader
      fullWidth
    >
      <Login
        content={{ title, description, features: typedFeatures }}
        initialTab={initialTab}
      />
    </Page>
  )
}
