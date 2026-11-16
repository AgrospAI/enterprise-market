import { translate } from '../../../i18n/translate'
import { Trans, useLingui } from '@lingui/react'
import { i18n } from '../../../i18n/index'
import { ReactElement } from 'react'
import { FileItem } from '@utils/fileItem'
import styles from './index.module.css'
import Button from '@shared/atoms/Button'
import CircleCheckIcon from '@images/circle_check.svg'
import DeleteButton from '@shared/DeleteButton/DeleteButton'
import useFileUpload from './useFileUpload'

export interface FileUploadProps {
  fileName?: string
  fileSize?: number
  fileType?: string
  buttonLabel: string
  setFileItem: (fileItem: FileItem, onError: () => void) => void | Promise<void>
  buttonStyle?: 'default' | 'accent'
  disabled?: boolean
  onReset?: () => void | Promise<void>
  showProgressBar?: boolean
  maxFileSizeKB?: number
}

export function FileUpload({
  buttonLabel,
  setFileItem,
  fileName,
  fileSize,
  fileType,
  buttonStyle = 'default',
  disabled = false,
  onReset,
  showProgressBar = false,
  maxFileSizeKB
}: FileUploadProps): ReactElement {
  useLingui()

  const {
    fileInputRef,
    currentFileName,
    hasUploadedFile,
    confirmedSize,
    confirmedType,
    isUploading,
    isResetting,
    uploadProgress,
    errorMessage,
    handleChange,
    handleButtonClick,
    handleResetClick
  } = useFileUpload({
    fileName,
    fileSize,
    fileType,
    disabled,
    onReset,
    setFileItem,
    maxFileSizeKB
  })

  return (
    <div className={styles.fileUpload}>
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={handleChange}
      />
      <div className={styles.actionsRow}>
        <Button
          type="button"
          style={buttonStyle === 'default' ? 'primary' : buttonStyle}
          onClick={handleButtonClick}
          className={styles.marginRight2}
          disabled={disabled || isUploading || isResetting}
        >
          {buttonLabel}
        </Button>
        {currentFileName && (
          <div className={styles.fileMeta} title={currentFileName}>
            <div className={styles.fileName}>{currentFileName}</div>
            {(isUploading || hasUploadedFile) && (
              <span className={styles.separator} aria-hidden="true" />
            )}
            {hasUploadedFile && (
              <div className={styles.confirmedStatus}>
                <CircleCheckIcon className={styles.successIcon} />
                <span className={styles.confirmedText}>
                  <Trans id="File confirmed" />
                </span>
                {confirmedSize && (
                  <span className={styles.confirmedMeta}>{confirmedSize}</span>
                )}
                {confirmedSize && confirmedType && (
                  <span className={styles.confirmedMeta}>•</span>
                )}
                {confirmedType && (
                  <span className={styles.confirmedMeta}>{confirmedType}</span>
                )}
              </div>
            )}
          </div>
        )}
        {hasUploadedFile && onReset && (
          <DeleteButton
            className={styles.deleteAction}
            onClick={handleResetClick}
            disabled={isResetting}
            loading={isResetting}
            loadingText={i18n._('Deleting...')}
          />
        )}
      </div>

      {showProgressBar && isUploading && (
        <div className={styles.progressBarWrapper}>
          <div className={styles.progressBarHeader}>
            <span className={styles.progressBarTitle}>
              {uploadProgress < 100
                ? i18n._('Uploading to IPFS...')
                : i18n._('Finalizing...')}
            </span>
            <span className={styles.progressPercentage}>{uploadProgress}%</span>
          </div>
          <div className={styles.progressBarContainer}>
            <div
              className={styles.progressBarFill}
              style={{ width: `${uploadProgress}%` }}
            >
              <div className={styles.progressBarGlow} />
            </div>
          </div>
          <div className={styles.progressBarDetails}>
            <span className={styles.progressFileName}>{currentFileName}</span>
            <span className={styles.progressFileSize}>
              {confirmedSize || i18n._('Calculating size...')}
            </span>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className={styles.errorMessageContainer}>
          <svg
            className={styles.errorIcon}
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
          >
            <circle
              cx="8"
              cy="8"
              r="7"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M8 4V9M8 11V12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <span className={styles.errorMessageText}>
            {translate(errorMessage)}
          </span>
        </div>
      )}
    </div>
  )
}
