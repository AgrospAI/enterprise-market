import { useLingui } from '@lingui/react'
import { i18n } from '../../../i18n/index'
import { ReactElement } from 'react'
import { useUserPreferences } from '@context/UserPreferences'
import Input from '@shared/FormInput'

export default function ExternalContent(): ReactElement {
  useLingui()

  const { allowExternalContent, setAllowExternalContent } = useUserPreferences()

  return (
    <Input
      label={i18n._('External content')}
      help={i18n._(
        "Load content from external sources in the assets' description."
      )}
      name="external content"
      type="checkbox"
      options={['Allow external content']}
      checked={allowExternalContent === true}
      onChange={() => setAllowExternalContent(!allowExternalContent)}
    />
  )
}
