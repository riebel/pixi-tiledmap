import { Container, Sprite, type Texture, TilingSprite } from 'pixi.js'
import { type GifSource, GifSprite } from 'pixi.js/gif'
import type { MapContext, ResolvedImageLayer } from '../types'
import { applyLayerState } from './renderableLayer.js'

export class ImageLayerRenderer extends Container {
  readonly layerData: ResolvedImageLayer
  private _tiledImage: TilingSprite | null = null

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

    this._tiledImage = new TilingSprite({
      texture,
      width: repeatx ? spanW : texture.width,
      height: repeaty ? spanH : texture.height
    })
    this.addChild(this._tiledImage)
  }

  applyParallax(
    cameraX: number,
    cameraY: number,
    originX: number,
    originY: number,
    parentParallaxX: number,
    parentParallaxY: number
  ): void {
    const dx = cameraX - originX
    const dy = cameraY - originY
    const effectiveParallaxX = this.layerData.parallaxx * parentParallaxX
    const effectiveParallaxY = this.layerData.parallaxy * parentParallaxY
    const repeatsX = this.layerData.repeatx && this._tiledImage !== null
    const repeatsY = this.layerData.repeaty && this._tiledImage !== null

    this.position.set(
      this.layerData.offsetx + dx * (repeatsX ? parentParallaxX : 1 - effectiveParallaxX),
      this.layerData.offsety + dy * (repeatsY ? parentParallaxY : 1 - effectiveParallaxY)
    )

    if (this._tiledImage) {
      this._tiledImage.tilePosition.set(
        repeatsX ? -dx * effectiveParallaxX : 0,
        repeatsY ? -dy * effectiveParallaxY : 0
      )
    }
  }
}
