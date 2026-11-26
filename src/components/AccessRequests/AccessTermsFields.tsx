import { useLingui } from '@lingui/react'
import { i18n } from '../../i18n/index'
import { ReactElement, useState } from 'react'
import { ServiceTerms } from '@utils/accessRequests/service'
import styles from './index.module.css'

const durations = [
  [86400, '1 day'],
  [604800, '1 week'],
  [2592000, '1 month'],
  [7776000, '3 months'],
  [15552000, '6 months'],
  [31536000, '1 year']
] as const

/** Price and duration share explicit unlimited/free controls and preserve edited values. */
export default function AccessTermsFields({
  terms,
  onChange
}: {
  terms: ServiceTerms
  onChange: (terms: ServiceTerms) => void
}): ReactElement {
  useLingui()
  const [paidPrice, setPaidPrice] = useState(terms.price)
  const [limitedTimeout, setLimitedTimeout] = useState(terms.timeout || 86400)
  const [free, setFree] = useState(Number(terms.price) === 0)
  const [unlimited, setUnlimited] = useState(terms.timeout === 0)
  const [duration, setDuration] = useState(
    durations.some(([seconds]) => seconds === terms.timeout)
      ? String(terms.timeout)
      : terms.timeout === 0
      ? '86400'
      : 'custom'
  )
  return (
    <>
      <h3>{i18n._('Access terms')}</h3>
      <div className={styles.accessTermsGroup}>
        <div className={styles.accessTermsBlock}>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={free}
              onChange={(e) => {
                setFree(e.target.checked)
                if (e.target.checked) setPaidPrice(terms.price)
                onChange({
                  ...terms,
                  price: e.target.checked
                    ? '0'
                    : Number(paidPrice) > 0
                    ? paidPrice
                    : ''
                })
              }}
            />
            {i18n._('Free access')}
          </label>
          {!free && (
            <label>
              {i18n._('Price')}{' '}
              <span className={styles.priceInput}>
                <span>devEURAU</span>
                <input
                  aria-label={i18n._('Price')}
                  className={styles.field}
                  type="number"
                  required
                  min="0.000000000000000001"
                  max="1000000"
                  step="any"
                  value={terms.price}
                  onChange={(e) => {
                    const price = e.target.value
                    onChange({
                      ...terms,
                      price: Number(price) > 0 ? price : ''
                    })
                  }}
                />
              </span>
            </label>
          )}
        </div>
        <div className={styles.accessTermsBlock}>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={unlimited}
              onChange={(e) => {
                setUnlimited(e.target.checked)
                if (e.target.checked) setLimitedTimeout(terms.timeout)
                onChange({
                  ...terms,
                  timeout: e.target.checked ? 0 : limitedTimeout
                })
              }}
            />
            {i18n._('Unlimited access')}
          </label>
          {!unlimited && (
            <div className={styles.durationFields}>
              <label>
                {i18n._('Access duration')}{' '}
                <select
                  className={styles.field}
                  value={duration}
                  onChange={(e) => {
                    setDuration(e.target.value)
                    if (e.target.value !== 'custom')
                      onChange({ ...terms, timeout: Number(e.target.value) })
                  }}
                >
                  {durations.map(([seconds, label]) => (
                    <option key={seconds} value={seconds}>
                      {i18n._(label)}
                    </option>
                  ))}
                  <option value="custom">{i18n._('Custom')}</option>
                </select>
              </label>
              {duration === 'custom' && (
                <label>
                  {i18n._('Custom duration (seconds)')}{' '}
                  <input
                    className={styles.field}
                    type="number"
                    required
                    min="1"
                    max="2147483647"
                    step="1"
                    value={Number.isNaN(terms.timeout) ? '' : terms.timeout}
                    onChange={(e) =>
                      onChange({
                        ...terms,
                        timeout:
                          e.target.value === '' ? NaN : Number(e.target.value)
                      })
                    }
                  />
                </label>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
