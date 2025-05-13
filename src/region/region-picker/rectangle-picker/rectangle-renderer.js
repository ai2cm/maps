import { select } from 'd3-selection'
import { getPathMaker, project } from '../circle-picker/utils'
import {
  polygon
} from '@turf/turf'
import CursorManager from './cursor-manager'

export default function RectangleRenderer({
  id,
  map,
  onIdle = (rectangle) => {},
  onDrag = (rectangle) => {},
  initialCenter = { lat: 0, lng: 0 },
  initialWidth = 100, 
  initialHeight = 100, 
  maxWidth = 1000,
  maxHeight = 1000,
  minWidth = 50,
  minHeight = 50,
  units = 'kilometers',
}) {
  let rectangle = null
  let center = initialCenter
  let centerXY = project(map, center)
  let width = initialWidth
  let height = initialHeight
  // Store the top-left corner position for fixed-corner resizing
  let topLeftCornerXY = {
    x: centerXY.x - (width / 2),
    y: centerXY.y - (height / 2)
  }

  const svg = select(`#rectangle-picker-${id}`).style('pointer-events', 'none')
  const svgRectangle = select(`#rectangle-${id}`).style('pointer-events', 'all')
  const svgRectangleCutout = select(`#rectangle-cutout-${id}`)
  const svgHandle = select(`#handle-${id}`).style('pointer-events', 'all')

  const removers = []

  //// LISTENERS ////

  function addCornerHandleListeners() {
    const handle = svgHandle
    const onMouseMove = (e) => {
      const mouseXY = e.point
      
      // Calculate new width and height based on the fixed top-left corner
      let newWidth = Math.max(mouseXY.x - topLeftCornerXY.x, 0)
      let newHeight = Math.max(mouseXY.y - topLeftCornerXY.y, 0)
      
      // Apply min/max constraints
      if (maxWidth) newWidth = Math.min(newWidth, maxWidth)
      if (minWidth) newWidth = Math.max(newWidth, minWidth)
      if (maxHeight) newHeight = Math.min(newHeight, maxHeight)
      if (minHeight) newHeight = Math.max(newHeight, minHeight)
      
      // Update values
      width = newWidth
      height = newHeight
      
      // Update center based on the new dimensions (keeping top-left fixed)
      centerXY = {
        x: topLeftCornerXY.x + (width / 2),
        y: topLeftCornerXY.y + (height / 2)
      }
      
      // Update geographic center
      center = map.unproject(centerXY)
      
      // Redraw rectangle
      setRectangle()
      onDrag(rectangle)
    }

    const onMouseUp = () => {
      onIdle(rectangle)
      setCursor({ draggingHandle: false })
      map.off('mousemove', onMouseMove)
      map.off('touchmove', onMouseMove)
      handle.style('pointer-events', 'all')
      svgRectangle.style('pointer-events', 'all')
    }

    const handleStart = (e) => {
      if (e.type === 'touchstart') {
        map.dragPan.disable()
        map.on('touchmove', onMouseMove)
        map.once('touchend', onMouseUp)
      } else {
        map.on('mousemove', onMouseMove)
        map.once('mouseup', onMouseUp)
      }
      setCursor({ draggingHandle: true })
      handle.style('pointer-events', 'none')
      svgRectangle.style('pointer-events', 'none')
    }

    handle.on('mousedown', handleStart)
    handle.on('touchstart', handleStart)

    removers.push(function removeHandleListeners() {
      handle.on('mousedown', null)
      handle.on('touchstart', null)
    })
  }

  function addRectangleListeners() {
    let offset
    const mapCanvas = map.getCanvas()

    const onMouseMove = (e) => {
      // Calculate the new center position
      const newCenter = {
        lng: e.lngLat.lng - offset.lng,
        lat: e.lngLat.lat - offset.lat,
      };
      
      // Calculate the new screen coordinates
      const newCenterXY = {
        x: e.point.x,
        y: e.point.y,
      };
      
      // Update the center
      center = newCenter;
      centerXY = newCenterXY;
      
      // Update the top-left corner position
      topLeftCornerXY = {
        x: centerXY.x - (width / 2),
        y: centerXY.y - (height / 2)
      };
      
      // Redraw the rectangle
      setRectangle();
      onDrag(rectangle);
    }

    const onMouseUp = () => {
      onIdle(rectangle)
      setCursor({ draggingRectangle: false })
      map.off('mousemove', onMouseMove)
      map.off('touchmove', onMouseMove)
      map.dragPan.enable()
      svgRectangle.style('pointer-events', 'all')
      svgHandle.style('pointer-events', 'all')
      svgRectangle.attr('stroke-width', 1)
    }

    const handleRectangleStart = (e) => {
      let point
      if (e.type === 'touchstart') {
        const touch = e.touches[0]
        point = { x: touch.pageX, y: touch.pageY }
        svgRectangle.attr('stroke-width', 4)
        map.dragPan.disable()
        map.on('touchmove', onMouseMove)
        map.once('touchend', onMouseUp)
      } else {
        point = { x: e.offsetX, y: e.offsetY }
        map.on('mousemove', onMouseMove)
        map.once('mouseup', onMouseUp)
      }
      const lngLat = map.unproject(point)
      offset = {
        lng: lngLat.lng - center.lng,
        lat: lngLat.lat - center.lat,
      }
      setCursor({ draggingRectangle: true })
      svgRectangle.style('pointer-events', 'none')
      svgHandle.style('pointer-events', 'none')
    }

    svgRectangle.on('mousedown', handleRectangleStart)
    svgRectangle.on('touchstart', handleRectangleStart)

    svgRectangle.on('wheel', (e) => {
      e.preventDefault()
      let newEvent = new e.constructor(e.type, e)
      mapCanvas.dispatchEvent(newEvent)
    })

    removers.push(function removeRectangleListeners() {
      svgRectangle.on('mousedown', null)
      svgRectangle.on('touchstart', null)
      svgRectangle.on('wheel', null)
    })
  }

  function addMapMoveListeners() {
    const onMove = () => {
      // Update the top-left corner position when map moves
      resetCenterXY()
      topLeftCornerXY = {
        x: centerXY.x - (width / 2),
        y: centerXY.y - (height / 2)
      }
      setRectangle()
    }

    map.on('move', onMove)
    removers.push(function removeMapMoveListeners() {
      map.off('move', onMove)
    })
  }

  //// RECTANGLE ////

  function geoRectangle(center, width, height, inverted = false) {
    // Convert the screen rectangle to geographic coordinates
    const halfWidth = width / 2
    const halfHeight = height / 2
    
    const topLeft = map.unproject([centerXY.x - halfWidth, centerXY.y - halfHeight])
    const topRight = map.unproject([centerXY.x + halfWidth, centerXY.y - halfHeight])
    const bottomRight = map.unproject([centerXY.x + halfWidth, centerXY.y + halfHeight])
    const bottomLeft = map.unproject([centerXY.x - halfWidth, centerXY.y + halfHeight])
    
    const coords = [
      [topLeft.lng, topLeft.lat],
      [topRight.lng, topRight.lat],
      [bottomRight.lng, bottomRight.lat],
      [bottomLeft.lng, bottomLeft.lat],
      [topLeft.lng, topLeft.lat] // Close the polygon
    ]
    
    const rect = polygon([coords], {
      properties: {
        center,
        width,
        height,
        units,
      }
    })
    
    rect.properties.area = width * height
    rect.properties.zoom = map.getZoom()
    
    return rect
  }

  //// SETTERS ////

  const setCursor = CursorManager(map)

  function setCenter(_center, _point) {
    if (_center && _center !== center) {
      center = _center
      centerXY = _point || project(map, center)
      // Update the top-left corner position
      topLeftCornerXY = {
        x: centerXY.x - (width / 2),
        y: centerXY.y - (height / 2)
      }
      setRectangle()
    }
  }

  function resetCenterXY() {
    // reset centerXY value based on latest `map` value
    centerXY = project(map, center, { referencePoint: centerXY })
  }

  function setRectangle() {
    // ensure that centerXY is up-to-date with map
    resetCenterXY()

    const makePath = getPathMaker(map, {
      referencePoint: centerXY,
    })

    // update svg rectangle
    rectangle = geoRectangle(center, width, height)
    const path = makePath(rectangle)
    svgRectangle.attr('d', path)

    // update cutout
    const cutoutRectangle = geoRectangle(center, width, height, true)
    const cutoutPath = makePath(cutoutRectangle)
    const { width: svgWidth, height: svgHeight } = svg.node().getBBox()
    svgRectangleCutout.attr('d', cutoutPath + ` M0,0H${svgWidth}V${svgHeight}H0V0z`)

    // Update handle positions
    const handleXY = {
      x: centerXY.x + (width / 2),
      y: centerXY.y + (height / 2)
    }

    svgHandle.attr('cx', handleXY.x).attr('cy', handleXY.y)

  }

  //// INIT ////

  addCornerHandleListeners()
  addRectangleListeners()
  addMapMoveListeners()
  setRectangle()
  onIdle(rectangle)

  //// INTERFACE ////

  return {
    remove: () => {
      removers.reverse().forEach((remove) => remove())
      onIdle(null)
    },
  }
}