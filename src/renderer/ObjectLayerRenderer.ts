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
    const color = td.color ?? '#000000'
    const text = new Text({
      text: td.text,
      style: {
        fontFamily: td.fontfamily ?? 'sans-serif',
        fontSize: td.pixelsize ?? 16,
        fill: color,
        fontWeight: td.bold ? 'bold' : 'normal',
        fontStyle: td.italic ? 'italic' : 'normal',
        wordWrap: td.wrap ?? false,
        wordWrapWidth: obj.width,
        align: td.halign ?? 'left'
      }
    })

    // PixiJS Text has no built-in underline/strikeout - draw them manually.
    // Wrap in a Container only when decorations are present so simple text
    // stays a single Text node.
    if (!td.underline && !td.strikeout) {
      text.position.set(obj.x, obj.y)
      text.angle = obj.rotation
      text.visible = obj.visible
      return text
    }

    const container = new Container()
    container.addChild(text)

    const metrics = text.getSize()
    const lineThickness = Math.max(1, (td.pixelsize ?? 16) / 16)
    if (td.underline) {
      const ul = new Graphics()
        .moveTo(0, metrics.height - lineThickness)
        .lineTo(metrics.width, metrics.height - lineThickness)
        .stroke({ color, width: lineThickness })
      container.addChild(ul)
    }
    if (td.strikeout) {
      const y = metrics.height / 2
      const so = new Graphics()
        .moveTo(0, y)
        .lineTo(metrics.width, y)
        .stroke({ color, width: lineThickness })
      container.addChild(so)
    }

    container.position.set(obj.x, obj.y)
    container.angle = obj.rotation
    container.visible = obj.visible
    return container
  }

  private _createRectangle(obj: ResolvedObject): Container {
    const g = new Graphics().rect(0, 0, obj.width, obj.height).stroke({ color: 0xffffff, width: 1 })
    g.position.set(obj.x, obj.y)
    g.angle = obj.rotation
    g.visible = obj.visible
    return g
  }

  private _createEllipse(obj: ResolvedObject): Container {
    const rx = obj.width / 2
    const ry = obj.height / 2
    const g = new Graphics().ellipse(rx, ry, rx, ry).stroke({ color: 0xffffff, width: 1 })
    g.position.set(obj.x, obj.y)
    g.angle = obj.rotation
    g.visible = obj.visible
    return g
  }

  private _createPoint(obj: ResolvedObject): Container {
    const g = new Graphics().circle(0, 0, 3).fill(0xffffff)
    g.position.set(obj.x, obj.y)
    g.visible = obj.visible
    return g
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

    g.position.set(obj.x, obj.y)
    g.angle = obj.rotation
    g.visible = obj.visible
    return g
  }
}
