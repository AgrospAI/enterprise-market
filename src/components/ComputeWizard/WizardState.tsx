import { useLingui } from '@lingui/react'
import { i18n } from '../../i18n/index'
import { ReactElement } from 'react'
import Loader from '@shared/atoms/Loader'

interface LoadingStateProps {
  containerClassName: string
  message?: string
}

export function LoadingState({
  containerClassName,
  message = i18n._('Loading compute wizard...')
}: LoadingStateProps): ReactElement {
  useLingui()

  return (
    <div className={containerClassName}>
      <Loader message={message} />
    </div>
  )
}

interface ErrorStateProps {
  containerClassName: string
  errorClassName: string
  title?: string
  message?: string
}

export function ErrorState({
  containerClassName,
  errorClassName,
  title = i18n._('Error'),
  message = i18n._('Something went wrong.')
}: ErrorStateProps): ReactElement {
  useLingui()

  return (
    <div className={containerClassName}>
      <h2>{title}</h2>
      <p className={errorClassName}>{message}</p>
    </div>
  )
}
