import type { TiledHAlign, TiledObject, TiledPoint, TiledText, TiledVAlign } from '../types'
import { parseProperties } from './tmxProperties.js'
import { bool, child, float, int, optInt, optStr, str } from './xmlHelpers.js'

export function parseObject(el: Element): TiledObject {
  const obj: TiledObject = {
    id: int(el, 'id'),
    name: str(el, 'name'),
    type: str(el, 'type') || str(el, 'class'),
    x: float(el, 'x'),
    y: float(el, 'y'),
    width: float(el, 'width'),
    height: float(el, 'height'),
    rotation: float(el, 'rotation'),
    visible: el.hasAttribute('visible') ? bool(el, 'visible', true) : true,
    properties: parseProperties(el)
  }

  const gid = optInt(el, 'gid')
  if (gid != null) obj.gid = gid

  const template = optStr(el, 'template')
  if (template) obj.template = template

  if (child(el, 'ellipse')) obj.ellipse = true
  if (child(el, 'point')) obj.point = true

  const polygonEl = child(el, 'polygon')
  if (polygonEl) {
    obj.polygon = parsePoints(str(polygonEl, 'points'))
  }

  const polylineEl = child(el, 'polyline')
  if (polylineEl) {
    obj.polyline = parsePoints(str(polylineEl, 'points'))
  }

  const textEl = child(el, 'text')
  if (textEl) {
    obj.text = parseTextObject(textEl)
  }

  return obj
}

function parsePoints(pointStr: string): TiledPoint[] {
  return pointStr
    .trim()
    .split(/\s+/)
    .map((pair) => {
      const [x, y] = pair.split(',').map(Number)
      return { x: x!, y: y! }
    })
}

function parseTextObject(el: Element): TiledText {
  return {
    text: el.textContent ?? '',
    fontfamily: optStr(el, 'fontfamily'),
    pixelsize: optInt(el, 'pixelsize'),
    wrap: bool(el, 'wrap') ? true : undefined,
    color: optStr(el, 'color'),
    bold: bool(el, 'bold') ? true : undefined,
    italic: bool(el, 'italic') ? true : undefined,
    underline: bool(el, 'underline') ? true : undefined,
    strikeout: bool(el, 'strikeout') ? true : undefined,
    kerning: el.hasAttribute('kerning') ? bool(el, 'kerning', true) : undefined,
    halign: optStr(el, 'halign') as TiledHAlign | undefined,
    valign: optStr(el, 'valign') as TiledVAlign | undefined
  }
}
