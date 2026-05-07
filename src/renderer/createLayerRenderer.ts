import type { Container, Texture } from 'pixi.js'
import type { GifSource } from 'pixi.js/gif'
import type { MapContext, ResolvedLayer, TiledLayerFilter } from '../types'
import { createLayerRendererFromContext } from './layerTreeRenderer.js'
import type { TileSetRenderer } from './TileSetRenderer.js'

export function createLayerRenderer(
  layer: ResolvedLayer,
  tilesets: TileSetRenderer[],
  ctx: MapContext,
  imageTextures: Map<string, Texture>,
  imageGifSources?: Map<string, GifSource>,
  layerFilter?: TiledLayerFilter
): Container | null {
  return createLayerRendererFromContext(layer, {
    tilesets,
    mapContext: ctx,
    imageTextures,
    imageGifSources,
    layerFilter
  })
}
