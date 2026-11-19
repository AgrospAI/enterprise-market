import { useLingui } from '@lingui/react'
import { AdditionalDdosFields } from '@components/@shared/AdditionalDdos'
import { useFormikContext } from 'formik'
import { ReactElement, useEffect } from 'react'
import { FormPublishData } from '../_types'

export function AdditionalCredentials(): ReactElement {
  useLingui()

  const { values, setFieldValue } = useFormikContext<FormPublishData>()
  useEffect(() => {
    if (values.additionalDdosPageVisited) {
      return
    }
    setFieldValue('additionalDdosPageVisited', true)
  })
  return <AdditionalDdosFields />
}
