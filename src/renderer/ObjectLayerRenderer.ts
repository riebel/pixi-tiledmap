import { Container, Graphics, type Sprite, Text } from 'pixi.js'
import type { ResolvedObject, ResolvedObjectLayer, TiledPoint, TiledText } from '../types'
import { applyLayerState } from './renderableLayer.js'
import type { TileSetRenderer } from './TileSetRenderer.js'
import { createObjectTileSprite } from './tileSpriteFactory.js'

export class ObjectLayerRenderer extends Container {
  readonly layerData: ResolvedObjectLayer

  constructor(layerData: ResolvedObjectLayer, tilesets: TileSetRenderer[]) {
    super()

    this.layerData = layerData
    applyLayerState(this, layerData)

    this._buildObjects(tilesets)
  }

  private _buildObjects(tilesets: TileSetRenderer[]): void {
    for (const obj of this.layerData.objects) {
      const child = this._createObject(obj, tilesets)
      if (child) {
        child.label = obj.name || `object_${obj.id}`
        this.addChild(child)
      }
    }
  }

  private _createObject(obj: ResolvedObject, tilesets: TileSetRenderer[]): Container | null {
    if (obj.tile) {
      return this._createTileObject(obj, tilesets)
    }

    if (obj.text) {
      return this._createTextObject(obj)
    }

    if (obj.ellipse) {
      return this._createEllipse(obj)
    }

    if (obj.point) {
      return this._createPoint(obj)
    }

    if (obj.polygon) {
      return this._createPolygon(obj, obj.polygon, true)
    }

    if (obj.polyline) {
      return this._createPolygon(obj, obj.polyline, false)
    }

    if (obj.width > 0 && obj.height > 0) {
      return this._createRectangle(obj)
    }

    return null
  }

  private _createTileObject(obj: ResolvedObject, tilesets: TileSetRenderer[]): Sprite | null {
    const tile = obj.tile!
    const ts = tilesets[tile.tilesetIndex]
    if (!ts) return null

    return createObjectTileSprite(tile, ts, {
      x: obj.x,
      y: obj.y,
      width: obj.width,
      height: obj.height,
      rotation: obj.rotation,
      visible: obj.visible
    })
  }

  private _createTextObject(obj: ResolvedObject): Container {
    const td = obj.text as TiledText
    const text = createText(td, obj.width)

    // PixiJS Text has no built-in underline/strikeout - draw them manually.
    // Wrap in a Container only when decorations are present so simple text
    // stays a single Text node.
    const node = td.underline || td.strikeout ? decorateText(text, td) : text
    return placeObject(node, obj)
  }

  private _createRectangle(obj: ResolvedObject): Container {
    const g = new Graphics().rect(0, 0, obj.width, obj.height).stroke({ color: 0xffffff, width: 1 })
    return placeObject(g, obj)
  }

  private _createEllipse(obj: ResolvedObject): Container {
    const rx = obj.width / 2
    const ry = obj.height / 2
    const g = new Graphics().ellipse(rx, ry, rx, ry).stroke({ color: 0xffffff, width: 1 })
    return placeObject(g, obj)
  }

  private _createPoint(obj: ResolvedObject): Container {
    const g = new Graphics().circle(0, 0, 3).fill(0xffffff)
    // A point marker has no orientation, so it ignores the object rotation.
    return placeObject(g, obj, false)
  }

  private _createPolygon(obj: ResolvedObject, points: TiledPoint[], closed: boolean): Container {
    const g = new Graphics()

    if (points.length > 0) {
      const first = points[0]!
      g.moveTo(first.x, first.y)
      for (let i = 1; i < points.length; i++) {
        const pt = points[i]!
        g.lineTo(pt.x, pt.y)
      }
      if (closed) {
        g.closePath()
      }
      g.stroke({ color: 0xffffff, width: 1 })
    }

    return placeObject(g, obj)
  }
}

const DEFAULT_TEXT_COLOR = '#000000'
const DEFAULT_PIXEL_SIZE = 16

function createText(td: TiledText, wrapWidth: number): Text {
  return new Text({
    text: td.text,
    style: {
      fontFamily: td.fontfamily ?? 'sans-serif',
      fontSize: td.pixelsize ?? DEFAULT_PIXEL_SIZE,
      fill: td.color ?? DEFAULT_TEXT_COLOR,
      fontWeight: td.bold ? 'bold' : 'normal',
      fontStyle: td.italic ? 'italic' : 'normal',
      wordWrap: td.wrap ?? false,
      wordWrapWidth: wrapWidth,
      align: td.halign ?? 'left'
    }
  })
}

/** Groups `text` with its underline and strikeout lines, sized to the rendered text. */
function decorateText(text: Text, td: TiledText): Container {
  const container = new Container()
  container.addChild(text)

  const { width, height } = text.getSize()
  const stroke = {
    color: td.color ?? DEFAULT_TEXT_COLOR,
    width: Math.max(1, (td.pixelsize ?? DEFAULT_PIXEL_SIZE) / DEFAULT_PIXEL_SIZE)
  }
  if (td.underline) {
    const y = height - stroke.width
    container.addChild(new Graphics().moveTo(0, y).lineTo(width, y).stroke(stroke))
  }
  if (td.strikeout) {
    const y = height / 2
    container.addChild(new Graphics().moveTo(0, y).lineTo(width, y).stroke(stroke))
  }
  return container
}

function placeObject<T extends Container>(node: T, obj: ResolvedObject, rotate = true): T {
  node.position.set(obj.x, obj.y)
  if (rotate) node.angle = obj.rotation
  node.visible = obj.visible
  return node
}
