import { useLingui } from '@lingui/react'
import { i18n } from '../../../i18n/index'
import { ReactElement } from 'react'
import Compute from '@images/compute.svg'
import Download from '@images/download.svg'
import { ServiceType } from 'src/@types/ddo/Service'

export default function ServiceTypeIcon({
  type,
  className,
  ariaHidden = true
}: {
  type?: string
  className?: string
  ariaHidden?: boolean
}): ReactElement | null {
  useLingui()

  if (type === ServiceType.Access) {
    return (
      <Download
        aria-hidden={ariaHidden}
        role={ariaHidden ? undefined : 'img'}
        aria-label={ariaHidden ? undefined : i18n._('Download')}
        className={className}
      />
    )
  }

  if (type === ServiceType.Compute) {
    return (
      <Compute
        aria-hidden={ariaHidden}
        role={ariaHidden ? undefined : 'img'}
        aria-label={ariaHidden ? undefined : i18n._('Compute')}
        className={className}
      />
    )
  }

  return null
}
