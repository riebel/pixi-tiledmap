import { Container, Sprite, type Texture, TilingSprite } from 'pixi.js'
import type { GifSource } from 'pixi.js/gif'
import type { MapContext, ResolvedImageLayer } from '../types'
import { acquireColorKeyedTexture, releaseColorKeyedTexture } from './colorKey.js'
import { getScreenOrigin } from './mapGeometry.js'
import { applyLayerState, destroysChildren, type RenderableLayer } from './renderableLayer.js'
import { createGifSprite } from './tileSpriteFactory.js'

export class ImageLayerRenderer extends Container {
  readonly layerData: ResolvedImageLayer
  private _tiledImage: TilingSprite | null = null
  /** The color-keyed copy of the image this layer holds and must release. */
  private _keyedTexture: Texture | null = null

  constructor(
    layerData: ResolvedImageLayer,
    texture: Texture | null,
    ctx?: MapContext,
    gifSource?: GifSource | null
  ) {
    super()

    this.layerData = layerData
    applyLayerState(this, layerData, ctx ? getScreenOrigin(ctx) : undefined)

    if (texture) {
      const keyed =
        layerData.transparentcolor && !gifSource
          ? acquireColorKeyedTexture(texture, layerData.transparentcolor)
          : null
      this._keyedTexture = keyed
      this._buildImage(keyed ?? texture, ctx, gifSource ?? null)
    }
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    super.destroy(options)
    // A sprite detached rather than destroyed still draws the keyed copy.
    if (this._keyedTexture && destroysChildren(options)) {
      releaseColorKeyedTexture(this._keyedTexture)
    }
    this._keyedTexture = null
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
    const { layerBaseOffsetX: baseX, layerBaseOffsetY: baseY } = this as unknown as RenderableLayer
    const layerX = baseX + dx * (1 - effectiveParallaxX)
    const layerY = baseY + dy * (1 - effectiveParallaxY)

    this.position.set(layerX, layerY)

    if (this._tiledImage) {
      this._tiledImage.position.set(repeatsX ? baseX - layerX : 0, repeatsY ? baseY - layerY : 0)
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
