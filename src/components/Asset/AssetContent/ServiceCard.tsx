import { Trans, useLingui } from '@lingui/react'
import { i18n } from '../../../i18n/index'
import { ReactElement, useState } from 'react'
import styles from './ServiceCard.module.css'
import { Service } from 'src/@types/ddo/Service'
import ServiceTypeIcon from '@shared/ServiceTypeIcon'
import { formatServiceTimeout } from '@utils/ddo'

export default function ServiceCard({
  service,
  accessDetails,
  onClick,
  isClickable
}: {
  service: Service
  accessDetails: AccessDetails
  onClick: () => void
  isClickable?: boolean
}): ReactElement {
  useLingui()

  const [expanded, setExpanded] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  if (!accessDetails) return null
  const clickable = isClickable === undefined ? true : isClickable
  const description = service.description?.['@value']

  return (
    <div
      onClick={(e) => {
        if (!clickable) {
          e.preventDefault()
          e.stopPropagation()
          return
        }
        onClick()
      }}
      className={`${styles.service} ${!clickable ? styles.disabled : ''}`}
      onMouseEnter={() => clickable && setIsHovered(true)}
      onMouseLeave={() => clickable && setIsHovered(false)}
      style={{
        cursor: clickable ? 'pointer' : 'not-allowed',
        opacity: clickable ? 1 : 0.5
      }}
    >
      <span className={styles.serviceTitle}>
        {service.name || i18n._('Unknown')}{' '}
      </span>
      <br />
      <div className={styles.descriptionWrapper}>
        {description ? (
          <>
            <span
              className={`${styles.serviceDescription} ${
                expanded ? styles.expanded : styles.collapsed
              }`}
            >
              {description}
            </span>
            {description.length > 50 && (
              <button
                type="button"
                className={styles.toggle}
                disabled={!clickable}
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  if (!clickable) return
                  setExpanded((prev) => !prev)
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {expanded ? i18n._('Show less') : i18n._('Show more')}
              </button>
            )}
          </>
        ) : (
          <span className={styles.serviceDescriptionPlaceholder}>
            <Trans id="No description available." />{' '}
          </span>
        )}
      </div>
      <span className={styles.title}>
        <Trans id="Type:" />{' '}
      </span>
      <span className={styles.access}>
        <ServiceTypeIcon
          type={
            service.type === 'access' ? i18n._('Download') : i18n._('Compute')
          }
          className={styles.typeIcon}
        />
        {service.type === 'access' ? i18n._('Download') : i18n._('Compute')}
      </span>
      <br />
      <span className={styles.title}>
        <Trans id="Access Duration:" />{' '}
      </span>
      <span>{formatServiceTimeout(service.timeout)}</span>
      <br />
      <span className={styles.title}>
        <Trans id="Price:" />{' '}
      </span>
      {accessDetails.type === 'fixed' ? (
        <>
          {accessDetails.price}{' '}
          <span className={styles.tokenSymbol}>
            {accessDetails.baseToken.symbol}
          </span>
        </>
      ) : (
        <span className={styles.free}>
          <Trans id="free" />
        </span>
      )}
      <br />
      <div
        className={`${styles.selectButtonWrapper} ${
          isHovered ? styles.visible : ''
        }`}
      >
        <button
          type="button"
          className={styles.selectButton}
          disabled={!clickable}
          style={{
            cursor: clickable ? 'pointer' : 'not-allowed'
          }}
        >
          <Trans id="Select" />{' '}
        </button>
      </div>
    </div>
  )
}
