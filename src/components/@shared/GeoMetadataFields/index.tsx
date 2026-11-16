import { useLingui } from '@lingui/react'
import { i18n } from '../../../i18n/index'
import { ReactElement } from 'react'
import { Field } from 'formik'
import Input from '@shared/FormInput'
import SectionContainer from '@shared/SectionContainer/SectionContainer'
import { getFieldContent } from '@utils/form'

// Shared by the publish and edit forms, which keep geoMetadata at different
// paths and read their field content from different files
export default function GeoMetadataFields({
  name,
  fields
}: {
  name: string
  fields: FormFieldContent[]
}): ReactElement {
  useLingui()

  return (
    <SectionContainer title={i18n._('Geographic Information')}>
      <Field
        {...getFieldContent('boundingBox', fields)}
        component={Input}
        name={`${name}.boundingBox`}
      />
      <Field
        {...getFieldContent('locationLabel', fields)}
        component={Input}
        name={`${name}.boundingBox.label`}
      />
      <Field
        {...getFieldContent('temporalCoverageStart', fields)}
        component={Input}
        name={`${name}.temporalCoverage.startDate`}
      />
      <Field
        {...getFieldContent('temporalCoverageEnd', fields)}
        component={Input}
        name={`${name}.temporalCoverage.endDate`}
      />
    </SectionContainer>
  )
}
