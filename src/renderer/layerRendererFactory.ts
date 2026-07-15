import type { Container, Texture } from 'pixi.js'
import type { GifSource } from 'pixi.js/gif'
import type { MapContext, ResolvedGroupLayer, ResolvedLayer, TiledLayerFilter } from '../types'
import { ImageLayerRenderer } from './ImageLayerRenderer.js'
import { ObjectLayerRenderer } from './ObjectLayerRenderer.js'
import { TileLayerRenderer } from './TileLayerRenderer.js'
import type { TileSetRenderer } from './TileSetRenderer.js'

export interface LayerTreeRendererContext {
  tilesets: TileSetRenderer[]
  mapContext: MapContext
  imageTextures: Map<string, Texture>
  imageGifSources?: Map<string, GifSource>
  layerFilter?: TiledLayerFilter
}

type GroupRendererFactory = (
  layer: ResolvedGroupLayer,
  context: LayerTreeRendererContext
) => Container

export function createLayerRendererWithGroupFactory(
  layer: ResolvedLayer,
  context: LayerTreeRendererContext,
  createGroupRenderer: GroupRendererFactory
): Container | null {
  const layerMatches = !context.layerFilter || context.layerFilter(layer)
  if (!layerMatches && !hasMatchingDescendant(layer, context.layerFilter)) return null
  if (layer.type === 'group') return createGroupRenderer(layer, context)
  if (!layerMatches) return null
  return createLeafLayerRenderer(layer, context)
}

function createLeafLayerRenderer(
  layer: Exclude<ResolvedLayer, ResolvedGroupLayer>,
  context: LayerTreeRendererContext
): Container {
  switch (layer.type) {
    case 'tilelayer':
      return new TileLayerRenderer(layer, context.tilesets, context.mapContext)

    case 'imagelayer': {
      const texture = layer.image ? (context.imageTextures.get(layer.image) ?? null) : null
      const gifSource = layer.image ? (context.imageGifSources?.get(layer.image) ?? null) : null
      return new ImageLayerRenderer(layer, texture, context.mapContext, gifSource)
    }

    case 'objectgroup':
      return new ObjectLayerRenderer(layer, context.tilesets)

    default:
      return assertNever(layer)
  }
}

function hasMatchingDescendant(layer: ResolvedLayer, layerFilter?: TiledLayerFilter): boolean {
  if (!layerFilter || layer.type !== 'group') return false
  return layer.layers.some(
    (child) => layerFilter(child) || hasMatchingDescendant(child, layerFilter)
  )
}

function assertNever(x: never): never {
  throw new Error(`Unhandled layer type: ${(x as { type: string }).type}`)
}
