import React, { useState, useEffect } from 'react'
import { useMapbox } from '../../../mapbox'
import RectangleRenderer from './rectangle-renderer'

const RectanglePicker = ({
  id,
  backgroundColor,
  center,
  color,
  width,
  height,
  onIdle,
  onDrag,
  units,
  maxWidth,
  maxHeight,
  minWidth,
  minHeight,
}) => {
  const { map } = useMapbox()
  const [renderer, setRenderer] = useState(null)

  useEffect(() => {
    const renderer = RectangleRenderer({
      id,
      map,
      onIdle,
      onDrag,
      initialCenter: center,
      initialWidth: width,
      initialHeight: height,
      maxWidth,
      maxHeight,
      minWidth,
      minHeight,
      units,
    })

    setRenderer(renderer)

    return function cleanup() {
      // need to check load state for fast-refresh purposes
      if (map.loaded()) renderer.remove()
    }
  }, [])

  return (
    <svg
      id={`rectangle-picker-${id}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
      }}
    >
      <defs>
        <clipPath id={`rectangle-clip-${id}`} clipRule='evenodd'>
          <path id={`rectangle-cutout-${id}`}  fillRule='evenodd'/>
        </clipPath>
      </defs>

      <path
        id={`rectangle-${id}`}
        stroke={color}
        strokeWidth={1}
        fill='transparent'
        cursor='move'
      />
      <rect
        x='0'
        y='0'
        width='100%'
        height='100%'
        clipPath={`url(#rectangle-clip-${id})`}
        fill={backgroundColor}
        fillOpacity={0.25}
      />
      <circle id={`handle-${id}`} r={8} fill={color} cursor='ew-resize' />
      {/* <line
        id={`radius-guideline-${id}`}
        stroke={color}
        strokeOpacity={0}
        strokeWidth={1}
        strokeDasharray='3,2'
      />
      <g id={`radius-text-container-${id}`}>
        <text
          id={`radius-text-${id}`}
          textAnchor='middle'
          fontFamily={fontFamily}
          fontSize={fontSize}
          fill={color}
        />
      </g> */}
    </svg>
  )
}

export default RectanglePicker
