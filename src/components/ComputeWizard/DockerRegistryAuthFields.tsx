import { Trans, useLingui } from '@lingui/react'
import { i18n } from '../../i18n/index'
import { ReactElement } from 'react'
import { Field } from 'formik'
import Input from '@shared/FormInput'
import styles from './DockerRegistryAuthFields.module.css'

export default function DockerRegistryAuthFields(): ReactElement {
  useLingui()

  return (
    <section
      className={styles.container}
      aria-labelledby="docker-registry-auth-title"
      aria-live="polite"
    >
      <h3 id="docker-registry-auth-title">
        <Trans id="Private Docker registry" />
      </h3>
      <p>
        <Trans id="The compute provider could not access the algorithm image. Enter the registry credentials if the image is private, then retry initialization. They are encrypted for the Ocean Node and are not stored in the asset metadata." />{' '}
      </p>
      <div className={styles.fields}>
        <Field
          component={Input}
          name="dockerRegistryUsername"
          label={i18n._('Registry username')}
          type="text"
          autoComplete="username"
          required
        />
        <Field
          component={Input}
          name="dockerRegistryPassword"
          label={i18n._('Registry password or access token')}
          type="password"
          autoComplete="new-password"
          required
        />
      </div>
    </section>
  )
}
