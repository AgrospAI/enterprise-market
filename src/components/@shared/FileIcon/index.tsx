import { Trans, useLingui } from '@lingui/react'
import { i18n } from '../../../i18n/index'
import { ReactElement } from 'react'
import { filesize } from 'filesize'
import cleanupContentType from '@utils/cleanupContentType'
import styles from './index.module.css'
import Loader from '@shared/atoms/Loader'
import { FileInfo } from '@oceanprotocol/lib'

function LoaderArea() {
  useLingui()

  return (
    <div className={styles.loaderWrap}>
      <Loader />
    </div>
  )
}

export default function FileIcon({
  file,
  isAccountWhitelisted,
  className,
  small,
  isLoading
}: {
  file: FileInfo
  isAccountWhitelisted: boolean
  className?: string
  small?: boolean
  isLoading?: boolean
}): ReactElement {
  useLingui()

  const styleClasses = `${styles.file} ${small ? styles.small : ''} ${
    className || ''
  }`

  return (
    <ul className={styleClasses}>
      {!isLoading ? (
        <>
          {isAccountWhitelisted &&
          (file?.contentType || file?.contentLength) ? (
            <>
              <li>{cleanupContentType(file.contentType)}</li>
              <li>
                {file.contentLength && file.contentLength !== '0'
                  ? filesize(Number(file.contentLength)).toString()
                  : ''}
              </li>
              <li>
                {file.type === 'smartcontract'
                  ? i18n._('smart\ncontract')
                  : file.type}
              </li>
            </>
          ) : (
            <li className={styles.empty}>
              <Trans id="No file info available" />
            </li>
          )}
        </>
      ) : (
        <LoaderArea />
      )}
    </ul>
  )
}
