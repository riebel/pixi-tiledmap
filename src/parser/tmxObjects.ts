import type {
  TiledHAlign,
  TiledObject,
  TiledPoint,
  TiledTemplateInstance,
  TiledText,
  TiledVAlign
} from '../types'
import { parseProperties } from './tmxProperties.js'
import { bool, child, float, int, optFloat, optInt, optStr, str } from './xmlHelpers.js'

/**
 * Parses a map object. A template instance keeps only the fields it sets,
 * like its TMJ form, although the declared type is `TiledObject`; see
 * `TiledTemplateInstance`.
 */
export function parseObject(el: Element): TiledObject {
  const template = optStr(el, 'template')
  const obj: TiledObject | TiledTemplateInstance = template
    ? parseTemplateInstanceFields(el, template)
    : ({
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
      } satisfies TiledObject)

  const opacity = optFloat(el, 'opacity')
  if (opacity !== undefined) obj.opacity = opacity

  const gid = optInt(el, 'gid')
  if (gid != null) obj.gid = gid

  if (child(el, 'ellipse')) obj.ellipse = true
  if (child(el, 'point')) obj.point = true
  if (child(el, 'capsule')) obj.capsule = true

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

  return obj as TiledObject
}

/**
 * Tiled writes a field on a template instance only when the instance changed
 * it. Leave the others absent, so the template can supply them.
 */
function parseTemplateInstanceFields(el: Element, template: string): TiledTemplateInstance {
  const obj: TiledTemplateInstance = {
    id: int(el, 'id'),
    template,
    type: str(el, 'type') || str(el, 'class'),
    x: float(el, 'x'),
    y: float(el, 'y')
  }
  if (el.hasAttribute('name')) obj.name = str(el, 'name')
  for (const key of ['width', 'height', 'rotation'] as const) {
    if (el.hasAttribute(key)) obj[key] = float(el, key)
  }
  if (el.hasAttribute('visible')) obj.visible = bool(el, 'visible', true)
  const properties = parseProperties(el)
  if (properties) obj.properties = properties
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
