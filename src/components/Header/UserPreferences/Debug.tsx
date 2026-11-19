import { useLingui } from '@lingui/react'
import { i18n } from '../../../i18n/index'
import { ReactElement } from 'react'
import { useUserPreferences } from '@context/UserPreferences'
import Input from '@shared/FormInput'

export default function Debug(): ReactElement {
  useLingui()

  const { debug, setDebug } = useUserPreferences()

  return (
    <Input
      label={i18n._('Debug')}
      help={i18n._(
        'Show geeky information in some places, and in your console.'
      )}
      name="debug"
      type="checkbox"
      options={['Activate Debug Mode']}
      defaultChecked={debug === true}
      onChange={() => setDebug(!debug)}
    />
  )
}
