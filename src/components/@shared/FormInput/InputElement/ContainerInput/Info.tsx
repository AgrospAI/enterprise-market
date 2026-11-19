import { Trans, useLingui } from '@lingui/react'
import { i18n } from '../../../../../i18n/index'
import { ReactElement } from 'react'
import styles from './Info.module.css'

export default function ImageInfo({
  image,
  tag,
  valid,
  handleClose
}: {
  image: string
  tag: string
  valid: boolean
  handleClose(): void
}): ReactElement {
  useLingui()

  const displayText = valid
    ? i18n._('✓ Image found, container checksum automatically added!')
    : i18n._(
        'x Container checksum could not be fetched automatically, please add it manually'
      )
  return (
    <div className={styles.info}>
      <h3 className={styles.contianer}>
        {i18n._('Image: {image} Tag: {tag}', { image, tag })}
      </h3>
      <ul>
        <li className={valid ? styles.success : styles.error}>{displayText}</li>
      </ul>
      <button className={styles.removeButton} onClick={handleClose}>
        <Trans id="&times;" />{' '}
      </button>
    </div>
  )
}
