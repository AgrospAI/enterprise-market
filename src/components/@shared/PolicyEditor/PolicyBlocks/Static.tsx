import { useLingui } from '@lingui/react'
import { ReactElement } from 'react'
import { Field } from 'formik'
import Input from '../../FormInput'
import { getFieldContent } from '@utils/form'
import styles from './Block.module.css'
import { contentSrcComponentsSharedPolicyEditorEditor as fields } from '../../../../i18n/content'
import DeleteButton from '../../DeleteButton/DeleteButton'
import InputGroup from '../../FormInput/InputGroup'

interface StaticPolicyBlockProps {
  name: string
  index: number
  innerIndex?: number
  onDelete: () => void
  readOnly?: boolean
}

export default function StaticPolicyBlock({
  name,
  index,
  innerIndex,
  onDelete,
  readOnly = false
}: StaticPolicyBlockProps): ReactElement {
  useLingui()

  const fieldName =
    innerIndex !== undefined
      ? `${name}.requestCredentials[${index}].policies[${innerIndex}].name`
      : `${name}.vcPolicies[${index}]`

  return (
    <div className={styles.block}>
      <InputGroup>
        <Field
          {...getFieldContent('staticPolicy', fields)}
          component={Input}
          name={fieldName}
          readOnly={readOnly}
          className={styles.policyInput}
          selectStyle="default"
        />
        <DeleteButton onClick={onDelete} disabled={readOnly} />
      </InputGroup>
    </div>
  )
}
