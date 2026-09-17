import type { Container, Texture } from 'pixi.js'
import type { GifSource } from 'pixi.js/gif'
import type { MapContext, ResolvedLayer, TiledLayerFilter, TiledObjectStyle } from '../types'
import { createLayerRendererFromContext } from './layerTreeRenderer.js'
import type { TileSetRenderer } from './TileSetRenderer.js'

/**
 * Builds the renderer for one resolved layer.
 *
 * It matches what `TiledMap` builds when `ctx` carries what `TiledMap` puts
 * there: `mapHeight` (map height in tiles, which places image layers on
 * isometric maps), `mapPixelWidth`/`mapPixelHeight` (for repeating image
 * layers) and the map's hexagonal, stagger and skew settings. `objectStyle`
 * is the `TiledMapOptions` option of the same name.
 */
export function createLayerRenderer(
  layer: ResolvedLayer,
  tilesets: TileSetRenderer[],
  ctx: MapContext,
  imageTextures: Map<string, Texture>,
  imageGifSources?: Map<string, GifSource>,
  layerFilter?: TiledLayerFilter,
  objectStyle?: TiledObjectStyle
): Container | null {
  return createLayerRendererFromContext(layer, {
    tilesets,
    mapContext: ctx,
    imageTextures,
    imageGifSources,
    layerFilter,
    objectStyle
  })
}
