import { Trans, useLingui } from '@lingui/react'
import { ReactElement } from 'react'
import dynamic from 'next/dynamic'
import { wktToBounds } from '@utils/dcat'
import styles from './index.module.css'

// Leaflet touches `window` on import, so the map is client-only
const Map = dynamic(() => import('./Map'), {
  ssr: false,
  loading: () => (
    <div className={styles.loading}>
      <Trans id="Loading map..." />
    </div>
  )
})

export default function BoundingBoxPreview({
  wkt,
  label
}: {
  wkt: string
  label?: string
}): ReactElement | null {
  useLingui()

  const bounds = wktToBounds(wkt)
  if (!bounds) return null

  return (
    <section className={styles.container}>
      <h4 className={styles.title}>
        <Trans id="Geographic Coverage" />
      </h4>
      {label && <p className={styles.label}>{label}</p>}
      <Map bounds={bounds} />
    </section>
  )
}
