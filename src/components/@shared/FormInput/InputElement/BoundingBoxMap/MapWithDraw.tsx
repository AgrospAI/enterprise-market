import { ReactElement, RefObject, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, FeatureGroup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw'
import 'leaflet-draw/dist/leaflet.draw.css'
import { LatLngBoundsTuple } from '@utils/dcat'
import LocationSearch from './LocationSearch'
import { rectangleStyle } from './_constants'
import styles from './index.module.css'

type BoundsChangeHandler = (
  bounds: LatLngBoundsTuple | null,
  label?: string
) => void

function toTuple(bounds: L.LatLngBounds): LatLngBoundsTuple {
  const sw = bounds.getSouthWest()
  const ne = bounds.getNorthEast()
  return [
    [sw.lat, sw.lng],
    [ne.lat, ne.lng]
  ]
}

// Rendered inside the FeatureGroup so both the map and the group exist
// by the time its effects run
function DrawController({
  bounds,
  featureGroupRef,
  onChange
}: {
  bounds: LatLngBoundsTuple | null
  featureGroupRef: RefObject<L.FeatureGroup>
  onChange: BoundsChangeHandler
}): null {
  const map = useMap()
  // Keep the latest handler without re-creating the toolbar on every render
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  // Drawn shapes are already in view, only external changes need a refit
  const skipNextFit = useRef(false)
  const boundsKey = bounds ? bounds.flat().join(',') : ''

  useEffect(() => {
    const featureGroup = featureGroupRef.current
    const drawControl = new L.Control.Draw({
      position: 'topright',
      draw: {
        // showArea is broken with Leaflet >= 1.8 (Leaflet.draw#1026)
        rectangle: { shapeOptions: rectangleStyle, showArea: false },
        polygon: false,
        circle: false,
        circlemarker: false,
        marker: false,
        polyline: false
      },
      edit: { featureGroup, remove: true }
    })
    map.addControl(drawControl)

    const handleCreated = (e: L.DrawEvents.Created) => {
      skipNextFit.current = true
      onChangeRef.current(toTuple((e.layer as L.Rectangle).getBounds()))
    }
    const handleEdited = (e: L.DrawEvents.Edited) => {
      e.layers.eachLayer((layer) => {
        if (layer instanceof L.Rectangle) {
          skipNextFit.current = true
          onChangeRef.current(toTuple(layer.getBounds()))
        }
      })
    }
    const handleDeleted = () => onChangeRef.current(null)

    map.on(L.Draw.Event.CREATED, handleCreated)
    map.on(L.Draw.Event.EDITED, handleEdited)
    map.on(L.Draw.Event.DELETED, handleDeleted)

    return () => {
      map.removeControl(drawControl)
      map.off(L.Draw.Event.CREATED, handleCreated)
      map.off(L.Draw.Event.EDITED, handleEdited)
      map.off(L.Draw.Event.DELETED, handleDeleted)
    }
  }, [map, featureGroupRef])

  // The form value is the source of truth for the drawn rectangle
  useEffect(() => {
    const featureGroup = featureGroupRef.current
    featureGroup.clearLayers()
    if (!bounds) return

    featureGroup.addLayer(L.rectangle(bounds, rectangleStyle))
    if (skipNextFit.current) {
      skipNextFit.current = false
    } else {
      map.fitBounds(bounds, { padding: [50, 50] })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, featureGroupRef, boundsKey])

  return null
}

export default function MapWithDraw({
  bounds,
  onChange
}: {
  bounds: LatLngBoundsTuple | null
  onChange: BoundsChangeHandler
}): ReactElement {
  const featureGroupRef = useRef<L.FeatureGroup>(null)

  return (
    <>
      <LocationSearch onLocationSelect={onChange} />
      <MapContainer
        center={[46.0, 11.0]}
        zoom={4}
        className={styles.map}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FeatureGroup ref={featureGroupRef}>
          <DrawController
            bounds={bounds}
            featureGroupRef={featureGroupRef}
            onChange={onChange}
          />
        </FeatureGroup>
      </MapContainer>
    </>
  )
}
