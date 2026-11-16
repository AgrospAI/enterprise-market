import { useLingui } from '@lingui/react'
import { ReactElement, useEffect } from 'react'
import { useFormikContext } from 'formik'
import { FormPublishData } from '../_types'
import styles from './index.module.css'
import { Feedback } from './Feedback'

export default function Submission(): ReactElement {
  useLingui()

  const { values, setFieldValue } = useFormikContext<FormPublishData>()

  useEffect(() => {
    if (values.submissionPageVisited) {
      return
    }
    setFieldValue('submissionPageVisited', true)
  }, [values.submissionPageVisited, setFieldValue])

  return (
    <div className={styles.submission}>
      <Feedback />
    </div>
  )
}
