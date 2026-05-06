import type { Container, Texture } from 'pixi.js'
import type { GifSource } from 'pixi.js/gif'
import type { MapContext, ResolvedLayer, TiledLayerFilter } from '../types'
import { GroupLayerRenderer } from './GroupLayerRenderer.js'
import { ImageLayerRenderer } from './ImageLayerRenderer.js'
import { ObjectLayerRenderer } from './ObjectLayerRenderer.js'
import { TileLayerRenderer } from './TileLayerRenderer.js'
import type { TileSetRenderer } from './TileSetRenderer.js'

export function createLayerRenderer(
  layer: ResolvedLayer,
  tilesets: TileSetRenderer[],
  ctx: MapContext,
  imageTextures: Map<string, Texture>,
  imageGifSources?: Map<string, GifSource>,
  layerFilter?: TiledLayerFilter
): Container | null {
  const layerMatches = !layerFilter || layerFilter(layer)
  if (!layerMatches && !hasMatchingDescendant(layer, layerFilter)) return null

  switch (layer.type) {
    case 'tilelayer':
      if (!layerMatches) return null
      return new TileLayerRenderer(layer, tilesets, ctx)

    case 'imagelayer': {
      if (!layerMatches) return null
      const tex = layer.image ? (imageTextures.get(layer.image) ?? null) : null
      const gifSource = layer.image ? (imageGifSources?.get(layer.image) ?? null) : null
      return new ImageLayerRenderer(layer, tex, ctx, gifSource)
    }

    case 'objectgroup':
      if (!layerMatches) return null
      return new ObjectLayerRenderer(layer, tilesets)

    case 'group':
      return new GroupLayerRenderer(
        layer,
        tilesets,
        ctx,
        imageTextures,
        imageGifSources,
        layerFilter
      )
  }
}

function hasMatchingDescendant(layer: ResolvedLayer, layerFilter?: TiledLayerFilter): boolean {
  if (!layerFilter || layer.type !== 'group') return false
  return layer.layers.some(
    (child) => layerFilter(child) || hasMatchingDescendant(child, layerFilter)
  )
}
