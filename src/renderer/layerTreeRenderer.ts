import type { Container, Texture } from 'pixi.js'
import type { GifSource } from 'pixi.js/gif'
import type { MapContext, ResolvedLayer, TiledLayerFilter } from '../types'
import { GroupLayerRenderer } from './GroupLayerRenderer.js'
import { ImageLayerRenderer } from './ImageLayerRenderer.js'
import { ObjectLayerRenderer } from './ObjectLayerRenderer.js'
import { isRenderableLayer, type RenderableLayer } from './renderableLayer.js'
import { TileLayerRenderer } from './TileLayerRenderer.js'
import type { TileSetRenderer } from './TileSetRenderer.js'

export interface LayerTreeRendererContext {
  tilesets: TileSetRenderer[]
  mapContext: MapContext
  imageTextures: Map<string, Texture>
  imageGifSources?: Map<string, GifSource>
  layerFilter?: TiledLayerFilter
}

export function createLayerRendererFromContext(
  layer: ResolvedLayer,
  context: LayerTreeRendererContext
): Container | null {
  const layerMatches = !context.layerFilter || context.layerFilter(layer)
  if (!layerMatches && !hasMatchingDescendant(layer, context.layerFilter)) return null

  switch (layer.type) {
    case 'tilelayer':
      if (!layerMatches) return null
      return new TileLayerRenderer(layer, context.tilesets, context.mapContext)

    case 'imagelayer': {
      if (!layerMatches) return null
      const texture = layer.image ? (context.imageTextures.get(layer.image) ?? null) : null
      const gifSource = layer.image ? (context.imageGifSources?.get(layer.image) ?? null) : null
      return new ImageLayerRenderer(layer, texture, context.mapContext, gifSource)
    }

    case 'objectgroup':
      if (!layerMatches) return null
      return new ObjectLayerRenderer(layer, context.tilesets)

    case 'group':
      return new GroupLayerRenderer(layer, context)

    default:
      return assertNever(layer)
  }
}

export function renderLayerTree(
  layers: ResolvedLayer[],
  context: LayerTreeRendererContext
): Container[] {
  const renderers: Container[] = []
  for (const layer of layers) {
    const renderer = createLayerRendererFromContext(layer, context)
    if (renderer) renderers.push(renderer)
  }
  return renderers
}

export function applyParallaxToLayerTree(
  children: Iterable<Container>,
  cameraX: number,
  cameraY: number,
  originX: number,
  originY: number
): void {
  for (const child of children) {
    if (isRenderableLayer(child)) {
      applyParallaxRecursive(child, cameraX, cameraY, originX, originY, 1, 1)
    }
  }
}

function assertNever(x: never): never {
  throw new Error(`Unhandled layer type: ${(x as { type: string }).type}`)
}

function hasMatchingDescendant(layer: ResolvedLayer, layerFilter?: TiledLayerFilter): boolean {
  if (!layerFilter || layer.type !== 'group') return false
  return layer.layers.some(
    (child) => layerFilter(child) || hasMatchingDescendant(child, layerFilter)
  )
}

function applyParallaxRecursive(
  layer: RenderableLayer,
  cameraX: number,
  cameraY: number,
  originX: number,
  originY: number,
  parentParallaxX: number,
  parentParallaxY: number
): void {
  const px = layer.layerParallaxX * parentParallaxX
  const py = layer.layerParallaxY * parentParallaxY

  layer.position.set(
    layer.layerBaseOffsetX + (cameraX - originX) * (1 - px),
    layer.layerBaseOffsetY + (cameraY - originY) * (1 - py)
  )

  for (const child of layer.children) {
    if (isRenderableLayer(child)) {
      applyParallaxRecursive(child, cameraX, cameraY, originX, originY, px, py)
    }
  }
}
