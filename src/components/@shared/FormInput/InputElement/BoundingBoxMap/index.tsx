import { ReactElement, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useField } from 'formik'
import { InputProps } from '../..'
import {
  boundsToWkt,
  FormGeoMetadata,
  LatLngBoundsTuple,
  wktToBounds
} from '@utils/dcat'
import styles from './index.module.css'

// Leaflet touches `window` on import, so the map is client-only
const MapWithDraw = dynamic(() => import('./MapWithDraw'), {
  ssr: false,
  loading: () => <div className={styles.loading}>Loading map...</div>
})

type BoundingBoxValue = FormGeoMetadata['boundingBox']

export default function BoundingBoxMap({ ...props }: InputProps): ReactElement {
  const { name } = props
  const [field, , helpers] = useField<BoundingBoxValue>(name)
  const wkt = field.value?.wkt || ''
  const label = field.value?.label || ''

  const bounds = useMemo(() => wktToBounds(wkt), [wkt])

  const handleChange = useCallback(
    (newBounds: LatLngBoundsTuple | null, newLabel?: string) => {
      helpers.setValue({
        wkt: newBounds ? boundsToWkt(newBounds) : '',
        label: newLabel ?? label
      })
      helpers.setTouched(true, false)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [label]
  )

  return (
    <div className={styles.container}>
      <MapWithDraw bounds={bounds} onChange={handleChange} />
      {wkt && (
        <div className={styles.wktDisplay}>
          <span className={styles.wktLabel}>WKT</span>
          <code className={styles.wktValue}>{wkt}</code>
        </div>
      )}
    </div>
  )
}
