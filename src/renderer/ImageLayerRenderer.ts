import { Container, Sprite, type Texture, TilingSprite } from 'pixi.js'
import type { MapContext, ResolvedImageLayer } from '../types'
import { parseTintColor } from './parseColor.js'

export class ImageLayerRenderer extends Container {
  readonly layerData: ResolvedImageLayer
  readonly layerBaseOffsetX: number
  readonly layerBaseOffsetY: number
  readonly layerParallaxX: number
  readonly layerParallaxY: number

  constructor(layerData: ResolvedImageLayer, texture: Texture | null, ctx?: MapContext) {
    super()

    this.layerData = layerData
    this.label = layerData.name
    this.alpha = layerData.opacity
    this.visible = layerData.visible
    this.layerBaseOffsetX = layerData.offsetx
    this.layerBaseOffsetY = layerData.offsety
    this.layerParallaxX = layerData.parallaxx
    this.layerParallaxY = layerData.parallaxy
    this.position.set(layerData.offsetx, layerData.offsety)
    if (layerData.tintcolor) {
      this.tint = parseTintColor(layerData.tintcolor)
    }

    if (texture) {
      this._buildImage(texture, ctx)
    }
  }

  private _buildImage(texture: Texture, ctx?: MapContext): void {
    const { repeatx, repeaty } = this.layerData

    if (!repeatx && !repeaty) {
      this.addChild(new Sprite(texture))
      return
    }

    // Size the tiling sprite so it spans the full map. If the map pixel size
    // is unavailable, fall back to the texture's natural size.
    const spanW = ctx?.mapPixelWidth && ctx.mapPixelWidth > 0 ? ctx.mapPixelWidth : texture.width
    const spanH =
      ctx?.mapPixelHeight && ctx.mapPixelHeight > 0 ? ctx.mapPixelHeight : texture.height

    this.addChild(
      new TilingSprite({
        texture,
        width: repeatx ? spanW : texture.width,
        height: repeaty ? spanH : texture.height
      })
    )
  }
}
