import { Container, Sprite, type Texture, TilingSprite } from 'pixi.js'
import type { GifSource } from 'pixi.js/gif'
import type { MapContext, ResolvedImageLayer } from '../types'
import { applyLayerState } from './renderableLayer.js'
import { createGifSprite } from './tileSpriteFactory.js'

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
      this.addChild(gifSource ? createGifSprite(gifSource) : new Sprite(texture))
      return
    }

    // Repeating layers use TilingSprite which requires a static texture.
    // Animated GIFs fall back to the first frame for tiling.
    this._tiledImage = new TilingSprite({
      texture,
      width: repeatx ? positiveOr(ctx?.mapPixelWidth, texture.width) : texture.width,
      height: repeaty ? positiveOr(ctx?.mapPixelHeight, texture.height) : texture.height
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
    const layerX = this.layerData.offsetx + dx * (1 - effectiveParallaxX)
    const layerY = this.layerData.offsety + dy * (1 - effectiveParallaxY)

    this.position.set(layerX, layerY)

    if (this._tiledImage) {
      this._tiledImage.position.set(
        repeatsX ? this.layerData.offsetx - layerX : 0,
        repeatsY ? this.layerData.offsety - layerY : 0
      )
      this._tiledImage.tilePosition.set(
        repeatsX ? -dx * effectiveParallaxX : 0,
        repeatsY ? -dy * effectiveParallaxY : 0
      )
    }
  }
}

/** `value` when it is a usable span; an unknown or empty map size falls back. */
function positiveOr(value: number | undefined, fallback: number): number {
  return value !== undefined && value > 0 ? value : fallback
}
