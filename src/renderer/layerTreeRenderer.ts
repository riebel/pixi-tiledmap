import type { Container } from 'pixi.js'
import type { ResolvedGroupLayer, ResolvedLayer } from '../types'
import { GroupLayerRenderer } from './GroupLayerRenderer.js'
import { ImageLayerRenderer } from './ImageLayerRenderer.js'
import {
  createLayerRendererWithGroupFactory,
  type LayerTreeRendererContext
} from './layerRendererFactory.js'
import { isRenderableLayer, type RenderableLayer } from './renderableLayer.js'

export type { LayerTreeRendererContext } from './layerRendererFactory.js'

export function createLayerRendererFromContext(
  layer: ResolvedLayer,
  context: LayerTreeRendererContext
): Container | null {
  return createLayerRendererWithGroupFactory(layer, context, createGroupLayerRenderer)
}

function createGroupLayerRenderer(
  layer: ResolvedGroupLayer,
  context: LayerTreeRendererContext
): GroupLayerRenderer {
  return new GroupLayerRenderer(layer, context)
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

  if (layer instanceof ImageLayerRenderer) {
    layer.applyParallax(cameraX, cameraY, originX, originY, parentParallaxX, parentParallaxY)
  } else {
    layer.position.set(
      layer.layerBaseOffsetX + (cameraX - originX) * (1 - px),
      layer.layerBaseOffsetY + (cameraY - originY) * (1 - py)
    )
  }

  for (const child of layer.children) {
    if (isRenderableLayer(child)) {
      applyParallaxRecursive(child, cameraX, cameraY, originX, originY, px, py)
    }
  }
}
