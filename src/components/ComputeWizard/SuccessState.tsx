import { i18n } from '../../i18n/index'
import { Trans, useLingui } from '@lingui/react'
import { ReactElement } from 'react'
import SuccessConfetti from '@shared/SuccessConfetti'
import Button from '@shared/atoms/Button'
import styles from './index.module.css'
import { CopyToClipboard } from '@shared/CopyToClipboard'

interface SuccessStateProps {
  jobId?: string
  onContinue: () => void
  containerClassName?: string
  detailsClassName?: string
  jobIdContainerClassName?: string
  buttonClassName?: string
}

export default function SuccessState({
  jobId,
  onContinue,
  containerClassName,
  detailsClassName,
  jobIdContainerClassName,
  buttonClassName
}: SuccessStateProps): ReactElement {
  useLingui()

  return (
    <div className={containerClassName}>
      <SuccessConfetti success="Job Started Successfully!" />
      <div className={detailsClassName}>
        <h3>
          <Trans id="Compute Job Started!" />
        </h3>
        <p>
          <Trans id="Your compute job is now running and processing your data." />
        </p>
        {jobId && jobId !== 'N/A' && (
          <div className={jobIdContainerClassName}>
            <div className={styles.jobIdRow}>
              <strong>
                <Trans id="Job ID:" />
              </strong>
              <CopyToClipboard
                value={jobId}
                truncate={8}
                className={styles.jobIdCopy}
                textClassName={styles.jobIdValue}
                showCopyButton
                copyButtonLabel={i18n._('Copy')}
              />
            </div>
          </div>
        )}
        <p>
          <Trans id="You can monitor the progress in your profile or on the asset page." />{' '}
        </p>
        <p>
          <Trans id="Please close this wizard to continue." />
        </p>
        <Button
          style="gradient"
          className={buttonClassName}
          onClick={onContinue}
        >
          <Trans id="Continue" />{' '}
        </Button>
      </div>
    </div>
  )
}
