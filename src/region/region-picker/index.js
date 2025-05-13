import React, { useState, useRef, useCallback, useEffect } from 'react'
import CirclePicker from './circle-picker'
import RectanglePicker from './rectangle-picker'
import { UPDATE_STATS_ON_DRAG } from './constants'
// import { distance } from '@turf/turf'
import { v4 as uuidv4 } from 'uuid'

import { useRegionContext } from '../context'
import { useMapbox } from '../../mapbox'
import mapboxgl from 'mapbox-gl'

// function getInitialRadius(map, units, minRadius, maxRadius) {
//   const bounds = map.getBounds().toArray()
//   const dist = distance(bounds[0], bounds[1], { units })
//   let radius = Math.round(dist / 15)
//   radius = minRadius ? Math.max(minRadius, radius) : radius
//   radius = maxRadius ? Math.min(maxRadius, radius) : radius

//   return radius
// }

function isValidCoordinate(longitude, latitude) {
  return (
    typeof longitude === 'number' &&
    typeof latitude === 'number' &&
    !isNaN(longitude) &&
    !isNaN(latitude) &&
    latitude >= -90 &&
    latitude <= 90
  )
}

function getInitialCenter(map, center) {
  if (
    Array.isArray(center) &&
    center.length === 2 &&
    isValidCoordinate(center[0], center[1])
  ) {
    return new mapboxgl.LngLat(center[0], center[1])
  } else {
    if (center) {
      console.warn(
        `Invalid initialCenter provided: ${center}. Should be [lng, lat]. Using map center instead.`
      )
    }
    return map.getCenter()
  }
}

// TODO:
// - accept mode (only accept mode="circle" to start)
function RegionPicker({
  backgroundColor,
  color,
  fontFamily,
  fontSize,
  units = 'kilometers',
  // initialRadius: initialRadiusProp,
  initialCenter: initialCenterProp,
  initialWidth,
  initialHeight,
  maxWidth,
  maxHeight,
  minWidth,
  minHeight,
}) {
  const { map } = useMapbox()
  const id = useRef(uuidv4())

  const initialCenter = useRef(getInitialCenter(map, initialCenterProp))

  // const initialRadius = useRef(
  //   initialRadiusProp || getInitialRadius(map, units, minRadius, maxRadius)
  // )
  const { setRegion } = useRegionContext()

  const [center, setCenter] = useState(initialCenter.current)

  useEffect(() => {
    return () => {
      // Clear region when unmounted
      setRegion(null)
    }
  }, [])

  const handleRectangle = useCallback((rect) => {
    if (!rect) return
    setRegion(rect)
    setCenter(rect.properties.center)
  }, [])

  // TODO: consider extending support for degrees and radians
  if (!['kilometers', 'miles'].includes(units)) {
    throw new Error('Units must be one of miles, kilometers')
  }

  return (
    <RectanglePicker
      id={id.current}
      map={map}
      center={initialCenter.current}
      width={initialWidth}
      height={initialHeight}
      onDrag={UPDATE_STATS_ON_DRAG ? handleRectangle : undefined}
      onIdle={handleRectangle}
      backgroundColor={backgroundColor}
      color={color}
      maxWidth={maxWidth}
      maxHeight={maxHeight}
      minWidth={minWidth}
      minHeight={minHeight}
      units={units}
    />
  )
}

export default RegionPicker
