import type { Container, Texture } from 'pixi.js'
import type { GifSource } from 'pixi.js/gif'
import type {
  MapContext,
  ResolvedGroupLayer,
  ResolvedLayer,
  TiledLayerFilter,
  TiledObjectStyle
} from '../types'
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
  objectStyle?: TiledObjectStyle
  /** Set below a group layer that blends other than `normal`. */
  insideBlendedGroup?: boolean
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
  const renderer = createLeafLayerRenderer(layer, context)
  if (layer.type !== 'imagelayer' && !context.insideBlendedGroup && !blendsOtherThanNormal(layer)) {
    renderer.isRenderGroup = true
  }
  return renderer
}

/**
 * Tile and object layers are PixiJS render groups, so their batched geometry
 * stays in layer space: moving the camera, the map, or the layer (parallax)
 * only updates the group's transform, instead of re-transforming every quad
 * on the CPU each frame, and rebuilding one layer does not rebuild the
 * others' instructions. PixiJS does not apply a render group's blend mode to
 * what it draws, so a layer that blends, or sits in a group that does, stays
 * an ordinary container.
 */
export function blendsOtherThanNormal(layer: ResolvedLayer): boolean {
  return !!layer.mode && layer.mode !== 'normal'
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
      return new ObjectLayerRenderer(
        layer,
        context.tilesets,
        context.objectStyle,
        context.mapContext
      )

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
