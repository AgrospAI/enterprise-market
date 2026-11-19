import { i18n } from '../../../../../i18n/index'
import { useLingui } from '@lingui/react'
import { ReactElement } from 'react'
import { FormPublishData } from '@components/Publish/_types'
import classNames from 'classnames/bind'
import { ErrorMessage, Field, useFormikContext } from 'formik'
import { getObjectPropertyByPath } from '@utils/index'
import FormAlignedKeyValue from '../KeyValueInput/FormAlignedKeyValue'
import styles from './OptionsInput.module.css'

const cx = classNames.bind(styles)

export default function OptionsInput(props: any): ReactElement {
  useLingui()

  const { errors, touched } = useFormikContext<FormPublishData>()

  const hasError = (): boolean =>
    [errors, touched].every(
      (object) => !!getObjectPropertyByPath(object, props.name)
    )

  return (
    <div className={cx({ container: true, hasError: hasError() })}>
      <Field
        {...props}
        component={FormAlignedKeyValue}
        uniqueKeys
        keyPlaceholder={i18n._('value')}
        valuePlaceholder={i18n._('label')}
      />

      {hasError() && (
        <div className={styles.error}>
          <ErrorMessage name={props.name} />
        </div>
      )}
    </div>
  )
}
