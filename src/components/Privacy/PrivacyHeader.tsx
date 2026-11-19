import { useLingui } from '@lingui/react'
import { i18n } from '../../i18n/index'
import { ReactElement } from 'react'
import Time from '@shared/atoms/Time'
import { usePrivacyMetadata } from '@hooks/usePrivacyMetadata'
import PrivacyLanguages from './PrivacyLanguages'
import AnchorNavigation from '@shared/AnchorNavigation'

export default function PrivacyPolicyHeader({
  documentDate,
  fileLastUpdated
}: {
  documentDate?: string
  fileLastUpdated?: string
}): ReactElement {
  useLingui()

  const { policies } = usePrivacyMetadata()
  const policyMetadata = policies && policies.length > 0 ? policies[0] : null
  // The document's own `lastUpdated` front matter wins: it is the only source
  // that records when this particular text changed. policies.json describes a
  // single policy and carries one shared date, and fileLastUpdated degrades to
  // the image build date in the container, which ships neither git nor .git.
  const resolvedDate =
    documentDate ||
    policyMetadata?.date ||
    fileLastUpdated ||
    new Date().toISOString().split('T')[0]
  const params = policyMetadata?.params || {
    languageLabel: i18n._('Language'),
    updated: i18n._('Last updated on'),
    dateFormat: 'MMMM dd, yyyy.'
  }

  // Only keep an `anchor` where the target renders that id: the terms,
  // privacy and cookie pages have no matching heading id, so their tabs just
  // open the page. rehype-slug gives the imprint and lifecycle policy H1s
  // their ids.
  const navItems = [
    {
      label: i18n._('Imprint'),
      href: '/privacy/imprint'
    },
    {
      label: i18n._('Terms and Conditions'),
      href: '/privacy/terms'
    },
    {
      label: i18n._('Privacy Policy'),
      href: '/privacy/privacy-policy'
    },
    // No Data Portal Usage Agreement tab: the upstream document (naming Ocean
    // Enterprise Collective e.V. as the Portal Operator) was removed, so
    // /privacy/data-portal-usage-agreement returns 404 unless
    // NEXT_PUBLIC_DPUA_URL points at an external document. Add the tab back
    // once an AgrospAI version exists.
    {
      label: i18n._('Cookie Policy'),
      href: '/privacy/cookie-policy'
    },
    {
      label: i18n._('Lifecycle State Policy'),
      href: '/privacy/lifecycle-state-policy'
    }
  ]

  return (
    <div>
      <PrivacyLanguages label={params.languageLabel} />
      <AnchorNavigation items={navItems} />
      <p>
        <em>
          {params?.updated || i18n._('Last updated on')}{' '}
          <Time date={resolvedDate} displayFormat="PP" />
        </em>
      </p>
    </div>
  )
}
