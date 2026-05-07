import { Container, Sprite, type Texture, TilingSprite } from 'pixi.js'
import { type GifSource, GifSprite } from 'pixi.js/gif'
import type { MapContext, ResolvedImageLayer } from '../types'
import { applyLayerState } from './renderableLayer.js'

export class ImageLayerRenderer extends Container {
  readonly layerData: ResolvedImageLayer

  constructor(
    layerData: ResolvedImageLayer,
    texture: Texture | null,
    ctx?: MapContext,
    gifSource?: GifSource | null
  ) {
    super()

    this.layerData = layerData
    applyLayerState(this, layerData)

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
