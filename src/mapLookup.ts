import type { ResolvedLayer, TiledProperty, TiledPropertyValue } from './types/index.js'

/** Anything holding a `layers` list: a `ResolvedMap` or a `ResolvedGroupLayer`. */
export interface LayerHolder {
  layers: readonly ResolvedLayer[]
}

/** Anything carrying Tiled custom properties: a map, layer, object, or tileset. */
export interface PropertyHolder {
  properties?: readonly TiledProperty[]
}

/**
 * Walks the layer tree depth-first, yielding group layers themselves as well as
 * their children.
 */
export function* walkLayers(holder: LayerHolder): Generator<ResolvedLayer> {
  for (const layer of holder.layers) {
    yield layer
    if (layer.type === 'group') yield* walkLayers(layer)
  }
}

/**
 * Finds a layer by name anywhere in the layer tree, including inside nested
 * group layers. Returns the first match in depth-first order; `undefined` when
 * no layer has that name.
 *
 * This is the `ResolvedMap` counterpart to `TiledMap.getLayer`, which searches
 * the rendered PixiJS tree instead.
 */
export function findLayer(holder: LayerHolder, name: string): ResolvedLayer | undefined {
  for (const layer of walkLayers(holder)) {
    if (layer.name === name) return layer
  }
  return undefined
}

/** Finds a layer by its Tiled id anywhere in the layer tree. */
export function findLayerById(holder: LayerHolder, id: number): ResolvedLayer | undefined {
  for (const layer of walkLayers(holder)) {
    if (layer.id === id) return layer
  }
  return undefined
}

/**
 * Reads a Tiled custom property's value by name, or `undefined` when the holder
 * has no such property.
 */
export function getProperty(holder: PropertyHolder, name: string): TiledPropertyValue | undefined {
  return holder.properties?.find((property) => property.name === name)?.value
}
