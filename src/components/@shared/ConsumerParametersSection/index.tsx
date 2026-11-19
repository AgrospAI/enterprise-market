import { useLingui } from '@lingui/react'
import { i18n } from '../../../i18n/index'
import { Field, useFormikContext } from 'formik'
import { ReactElement } from 'react'
import Input from '@shared/FormInput'
import { getFieldContent } from '@utils/form'
import {
  contentPublishConsumerParameters as consumerParametersContent,
  contentPublishForm as content
} from '../../../i18n/content'
import SectionContainer from '../SectionContainer/SectionContainer'
import { FormPublishData } from '../../Publish/_types'
import { isFileTypeCompatibleWithConsumerParameters } from '@utils/fileTypes'

interface ConsumerParametersSectionProps {
  title?: string
  fieldNamePrefix: string
  type?: 'consumerParametersBuilder' | 'consumerParameters'
  help?: string
}

export default function ConsumerParametersSection({
  title = i18n._('Consumer Parameters'),
  fieldNamePrefix,
  type = 'consumerParameters',
  help
}: ConsumerParametersSectionProps): ReactElement {
  useLingui()

  const { values } = useFormikContext<FormPublishData>()

  const getFieldValue = (field: string) => {
    const path = `${fieldNamePrefix}.${field}`
    const pathParts = path.split('.')
    let value = values

    for (const part of pathParts) {
      if (part.includes('[') && part.includes(']')) {
        const arrayMatch = part.match(/(.+)\[(\d+)\]/)
        if (arrayMatch) {
          const [, arrayName, index] = arrayMatch
          value = value?.[arrayName]?.[parseInt(index)]
        }
      } else {
        value = value?.[part]
      }
    }
    return value
  }

  const usesConsumerParameters = getFieldValue('usesConsumerParameters')

  const currentFileType = values.services?.[0]?.files?.[0]?.type || 'url'
  const isCompatible =
    isFileTypeCompatibleWithConsumerParameters(currentFileType)
  if (!isCompatible) {
    return null
  }

  return (
    <SectionContainer title={title} help={help}>
      <Field
        {...getFieldContent(
          'usesConsumerParameters',
          fieldNamePrefix.includes('services')
            ? (content as any).services?.fields
            : (content as any).metadata?.fields
        )}
        component={Input}
        name={`${fieldNamePrefix}.usesConsumerParameters`}
      />

      {usesConsumerParameters && (
        <div>
          <Field
            {...getFieldContent(
              'consumerParameters',
              consumerParametersContent.consumerParameters.fields
            )}
            component={Input}
            name={`${fieldNamePrefix}.consumerParameters`}
            type={type}
          />
        </div>
      )}
    </SectionContainer>
  )
}
