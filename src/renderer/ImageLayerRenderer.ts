import { Container, Sprite, type Texture, TilingSprite } from 'pixi.js'
import { type GifSource, GifSprite } from 'pixi.js/gif'
import type { MapContext, ResolvedImageLayer } from '../types'
import { parseTintColor } from './parseColor.js'

export class ImageLayerRenderer extends Container {
  readonly layerData: ResolvedImageLayer
  readonly layerBaseOffsetX: number
  readonly layerBaseOffsetY: number
  readonly layerParallaxX: number
  readonly layerParallaxY: number

  constructor(
    layerData: ResolvedImageLayer,
    texture: Texture | null,
    ctx?: MapContext,
    gifSource?: GifSource | null
  ) {
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
      this._buildImage(texture, ctx, gifSource ?? null)
    }
  }

  private _buildImage(texture: Texture, ctx?: MapContext, gifSource?: GifSource | null): void {
    const { repeatx, repeaty } = this.layerData

    if (!repeatx && !repeaty) {
      if (gifSource) {
        this.addChild(new GifSprite({ source: gifSource }))
      } else {
        this.addChild(new Sprite(texture))
      }
      return
    }

    // Repeating layers use TilingSprite which requires a static texture.
    // Animated GIFs fall back to the first frame for tiling.
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
