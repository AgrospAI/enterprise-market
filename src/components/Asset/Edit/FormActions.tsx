import { Trans, useLingui } from '@lingui/react'
import { FormikContextType, useFormikContext } from 'formik'
import { ReactElement } from 'react'
import { useAsset } from '@context/Asset'
import Button from '@shared/atoms/Button'
import styles from './FormActions.module.css'
import Link from 'next/link'
import { MetadataEditForm, ServiceEditForm } from './_types'

export default function FormActions({
  handleClick
}: {
  handleClick?: () => void
}): ReactElement {
  useLingui()

  const { isAssetNetwork, asset } = useAsset()
  const {
    errors,
    isValid,
    isSubmitting,
    isValidating
  }: FormikContextType<MetadataEditForm | ServiceEditForm> = useFormikContext()

  const validationErrors: { path: string; message: string }[] = []
  function collectErrors(value: unknown, path = '') {
    if (typeof value === 'string') {
      validationErrors.push({ path, message: value })
    } else if (value && typeof value === 'object') {
      Object.entries(value).forEach(([key, error]) =>
        collectErrors(error, path ? `${path}.${key}` : key)
      )
    }
  }
  collectErrors(errors)

  const isSubmitDisabled =
    !isValid || !isAssetNetwork || isSubmitting || isValidating

  return (
    <>
      {validationErrors.length > 0 && (
        <div role="alert" className={styles.errors}>
          <p>
            <Trans id="Please correct the following errors before submitting:" />
          </p>
          <ul>
            {validationErrors.map(({ path, message }) => (
              <li key={path}>
                <strong>{path}</strong>: {message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!isAssetNetwork && (
        <p role="alert">
          <Trans id="Connect to the asset network to submit changes." />
        </p>
      )}
      <footer className={styles.actions}>
        <Link href={`/asset/${asset?.id}`} key={asset?.id}>
          <Trans id="Cancel" />{' '}
        </Link>
        <Button
          type="submit"
          style="accent"
          disabled={isSubmitDisabled}
          onClick={handleClick}
        >
          <Trans id="Submit" />{' '}
        </Button>
      </footer>
    </>
  )
}
