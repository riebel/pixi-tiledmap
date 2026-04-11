import { Container, Graphics, Sprite, Text } from 'pixi.js'
import { decodeGid } from '../parser'
import type { ResolvedObjectLayer, TiledObject, TiledPoint, TiledText } from '../types'
import { parseTintColor } from './parseColor.js'
import type { TileSetRenderer } from './TileSetRenderer.js'

export class ObjectLayerRenderer extends Container {
  readonly layerData: ResolvedObjectLayer

  constructor(layerData: ResolvedObjectLayer, tilesets: TileSetRenderer[]) {
    super()

    this.layerData = layerData
    this.label = layerData.name
    this.alpha = layerData.opacity
    this.visible = layerData.visible
    this.position.set(layerData.offsetx, layerData.offsety)
    if (layerData.tintcolor) {
      this.tint = parseTintColor(layerData.tintcolor)
    }

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

  private _createObject(obj: TiledObject, tilesets: TileSetRenderer[]): Container | null {
    // Tile object (has gid)
    if (obj.gid !== undefined) {
      return this._createTileObject(obj, tilesets)
    }

    // Text object
    if (obj.text) {
      return this._createTextObject(obj)
    }

    // Shape objects
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

    // Rectangle (default)
    if (obj.width > 0 && obj.height > 0) {
      return this._createRectangle(obj)
    }

    return null
  }

  private _createTileObject(obj: TiledObject, tilesets: TileSetRenderer[]): Sprite | null {
    if (obj.gid === undefined) return null

    const decoded = decodeGid(obj.gid)
    if (!decoded) return null

    // Find the right tileset
    for (let i = tilesets.length - 1; i >= 0; i--) {
      const ts = tilesets[i]
      if (!ts) continue
      if (ts.tileset.firstgid <= decoded.gid) {
        const localId = decoded.gid - ts.tileset.firstgid
        const texture = ts.getTexture(localId)
        if (!texture) return null

        const sprite = new Sprite(texture)
        sprite.position.set(obj.x, obj.y - obj.height)
        sprite.width = obj.width
        sprite.height = obj.height
        sprite.angle = obj.rotation
        sprite.visible = obj.visible

        if (decoded.horizontalFlip) {
          sprite.scale.x *= -1
          sprite.anchor.x = 1
        }
        if (decoded.verticalFlip) {
          sprite.scale.y *= -1
          sprite.anchor.y = 1
        }

        return sprite
      }
    }
    return null
  }

  private _createTextObject(obj: TiledObject): Container {
    const td = obj.text as TiledText
    const text = new Text({
      text: td.text,
      style: {
        fontFamily: td.fontfamily ?? 'sans-serif',
        fontSize: td.pixelsize ?? 16,
        fill: td.color ?? '#000000',
        fontWeight: td.bold ? 'bold' : 'normal',
        fontStyle: td.italic ? 'italic' : 'normal',
        wordWrap: td.wrap ?? false,
        wordWrapWidth: obj.width,
        align: td.halign ?? 'left'
      }
    })
    text.position.set(obj.x, obj.y)
    text.angle = obj.rotation
    text.visible = obj.visible
    return text
  }

  private _createRectangle(obj: TiledObject): Container {
    const g = new Graphics().rect(0, 0, obj.width, obj.height).stroke({ color: 0xffffff, width: 1 })
    g.position.set(obj.x, obj.y)
    g.angle = obj.rotation
    g.visible = obj.visible
    return g
  }

  private _createEllipse(obj: TiledObject): Container {
    const rx = obj.width / 2
    const ry = obj.height / 2
    const g = new Graphics().ellipse(rx, ry, rx, ry).stroke({ color: 0xffffff, width: 1 })
    g.position.set(obj.x, obj.y)
    g.angle = obj.rotation
    g.visible = obj.visible
    return g
  }

  private _createPoint(obj: TiledObject): Container {
    const g = new Graphics().circle(0, 0, 3).fill(0xffffff)
    g.position.set(obj.x, obj.y)
    g.visible = obj.visible
    return g
  }

  private _createPolygon(obj: TiledObject, points: TiledPoint[], closed: boolean): Container {
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
