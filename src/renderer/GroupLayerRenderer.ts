import { Container, type Texture } from 'pixi.js'
import type { GifSource } from 'pixi.js/gif'
import type { MapContext, ResolvedGroupLayer, TiledLayerFilter } from '../types'
import { createLayerRenderer } from './createLayerRenderer.js'
import { parseTintColor } from './parseColor.js'
import type { TileSetRenderer } from './TileSetRenderer.js'

export class GroupLayerRenderer extends Container {
  readonly layerData: ResolvedGroupLayer
  readonly layerBaseOffsetX: number
  readonly layerBaseOffsetY: number
  readonly layerParallaxX: number
  readonly layerParallaxY: number

  constructor(
    layerData: ResolvedGroupLayer,
    tilesets: TileSetRenderer[],
    ctx: MapContext,
    imageTextures: Map<string, Texture>,
    imageGifSources?: Map<string, GifSource>,
    layerFilter?: TiledLayerFilter
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

    for (const child of layerData.layers) {
      const renderer = createLayerRenderer(
        child,
        tilesets,
        ctx,
        imageTextures,
        imageGifSources,
        layerFilter
      )
      if (renderer) this.addChild(renderer)
    }
  }
}
