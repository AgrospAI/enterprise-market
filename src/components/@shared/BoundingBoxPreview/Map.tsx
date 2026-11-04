import { ReactElement } from 'react'
import { MapContainer, TileLayer, Rectangle } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { LatLngBoundsTuple } from '@utils/dcat'
import { rectangleStyle } from '@shared/FormInput/InputElement/BoundingBoxMap/_constants'
import styles from './index.module.css'

export default function Map({
  bounds
}: {
  bounds: LatLngBoundsTuple
}): ReactElement {
  return (
    <MapContainer
      // MapContainer props are immutable, remount when the coverage changes
      key={bounds.flat().join(',')}
      bounds={bounds}
      boundsOptions={{ padding: [30, 30] }}
      className={styles.map}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Rectangle bounds={bounds} pathOptions={rectangleStyle} />
    </MapContainer>
  )
}
