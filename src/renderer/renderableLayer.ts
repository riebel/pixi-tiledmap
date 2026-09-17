import type { Container } from 'pixi.js'
import type {
  ResolvedGroupLayer,
  ResolvedImageLayer,
  ResolvedObjectLayer,
  ResolvedTileLayer
} from '../types'
import { parseTintColor } from './parseColor.js'

export type ResolvedRenderableLayer =
  | ResolvedTileLayer
  | ResolvedImageLayer
  | ResolvedObjectLayer
  | ResolvedGroupLayer

const renderableLayerMarker = Symbol('renderableLayer')

export interface RenderableLayer extends Container {
  readonly layerBaseOffsetX: number
  readonly layerBaseOffsetY: number
  readonly layerParallaxX: number
  readonly layerParallaxY: number
  readonly [renderableLayerMarker]: true
}

/**
 * Applies a layer's shared state to its container. `origin` shifts the layer's
 * base position, for layers Tiled places in screen space.
 */
export function applyLayerState(
  container: Container,
  layer: ResolvedRenderableLayer,
  origin: { x: number; y: number } = { x: 0, y: 0 }
): void {
  const baseX = layer.offsetx + origin.x
  const baseY = layer.offsety + origin.y
  container.label = layer.name
  container.alpha = layer.opacity
  container.visible = layer.visible
  container.position.set(baseX, baseY)
  if (layer.tintcolor) {
    container.tint = parseTintColor(layer.tintcolor)
  }

  Object.defineProperties(container, {
    layerBaseOffsetX: { value: baseX, enumerable: true },
    layerBaseOffsetY: { value: baseY, enumerable: true },
    layerParallaxX: { value: layer.parallaxx, enumerable: true },
    layerParallaxY: { value: layer.parallaxy, enumerable: true },
    [renderableLayerMarker]: { value: true }
  })
}

export function isRenderableLayer(container: Container): container is RenderableLayer {
  return (container as unknown as Partial<RenderableLayer>)[renderableLayerMarker] === true
}
