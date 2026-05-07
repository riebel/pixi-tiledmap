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

export function applyLayerState(container: Container, layer: ResolvedRenderableLayer): void {
  container.label = layer.name
  container.alpha = layer.opacity
  container.visible = layer.visible
  container.position.set(layer.offsetx, layer.offsety)
  if (layer.tintcolor) {
    container.tint = parseTintColor(layer.tintcolor)
  }

  Object.defineProperties(container, {
    layerBaseOffsetX: { value: layer.offsetx, enumerable: true },
    layerBaseOffsetY: { value: layer.offsety, enumerable: true },
    layerParallaxX: { value: layer.parallaxx, enumerable: true },
    layerParallaxY: { value: layer.parallaxy, enumerable: true },
    [renderableLayerMarker]: { value: true }
  })
}

export function isRenderableLayer(container: Container): container is RenderableLayer {
  return (container as unknown as Partial<RenderableLayer>)[renderableLayerMarker] === true
}
