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

/**
 * Whether `Container.destroy(options)` destroys the children too. Without
 * that, it only detaches them, and the caller may keep them alive.
 */
export function destroysChildren(options: Parameters<Container['destroy']>[0]): boolean {
  return typeof options === 'boolean' ? options : (options?.children ?? false)
}

/**
 * Runs `release` once every leaf under `roots` has been destroyed, or at once
 * when there are none. Used to hand shared textures over to children a
 * `destroy()` only detached, which keep drawing them. Leaves are the
 * drawables, so a group or layer that is itself destroyed without its
 * children does not count: its detached children still draw.
 */
export function releaseWhenDestroyed(roots: readonly Container[], release: () => void): void {
  const holders = collectLeaves(roots)
  let pending = holders.length
  if (pending === 0) {
    release()
    return
  }
  const onDestroyed = (): void => {
    if (--pending === 0) release()
  }
  for (const holder of holders) holder.once('destroyed', onDestroyed)
}

function collectLeaves(roots: readonly Container[]): Container[] {
  const leaves: Container[] = []
  const stack = [...roots]
  for (let node = stack.pop(); node; node = stack.pop()) {
    if (node.children.length === 0) leaves.push(node)
    else stack.push(...node.children)
  }
  return leaves
}

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
 *
 * Blend modes other than `normal`, `add`, `multiply` and `screen` render once
 * `loadMapBlendModes` has registered PixiJS' advanced blend modes.
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
  if (layer.mode && layer.mode !== 'normal') {
    container.blendMode = layer.mode
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
