import { useLingui } from '@lingui/react'
import { i18n } from '../../../i18n/index'
import { ReactElement } from 'react'
import { useUserPreferences } from '@context/UserPreferences'
import Input from '@shared/FormInput'

export default function Onboarding(): ReactElement {
  useLingui()

  const { showOnboardingModule, setShowOnboardingModule } = useUserPreferences()

  return (
    <Input
      label={i18n._('Onboarding')}
      help={i18n._('Show the onboarding tutorial module on the homepage.')}
      name="onboarding"
      type="checkbox"
      options={['Show onboarding tutorial']}
      checked={showOnboardingModule}
      onChange={() => setShowOnboardingModule(!showOnboardingModule)}
    />
  )
}
