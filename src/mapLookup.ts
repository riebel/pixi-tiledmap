import type {
  ResolvedLayer,
  TiledProperty,
  TiledPropertyType,
  TiledPropertyValue
} from './types/index.js'

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
 * The JavaScript type each Tiled property type carries. `class` is the one
 * exception: its value shape is author-defined, so it cannot be narrowed.
 */
export interface TiledPropertyValueByType {
  string: string
  color: string
  file: string
  int: number
  float: number
  object: number
  bool: boolean
  class: TiledPropertyValue
}

/**
 * Reads a Tiled custom property's value by name, or `undefined` when the holder
 * has no such property.
 *
 * Pass the expected Tiled property type to narrow the result, which saves every
 * caller writing the same type guard:
 *
 * ```ts
 * const theme = getProperty(map, 'theme', 'string') // string | undefined
 * const depth = getProperty(map, 'depth', 'int') // number | undefined
 * ```
 *
 * A property whose declared type differs from the requested one reads as
 * `undefined` rather than throwing, as does one whose value does not actually
 * match its own declaration - so the narrowed type is never a lie.
 */
export function getProperty(holder: PropertyHolder, name: string): TiledPropertyValue | undefined
export function getProperty<T extends TiledPropertyType>(
  holder: PropertyHolder,
  name: string,
  type: T
): TiledPropertyValueByType[T] | undefined
export function getProperty(
  holder: PropertyHolder,
  name: string,
  type?: TiledPropertyType
): TiledPropertyValue | undefined {
  const property = holder.properties?.find((entry) => entry.name === name)
  if (!property) return undefined
  if (type === undefined) return property.value

  // Tiled omits `type` for string properties, string being its default, so a
  // map read straight from a `.tmj` may carry no type at all.
  if ((property.type ?? 'string') !== type) return undefined
  return hasRuntimeType(property.value, type) ? property.value : undefined
}

function hasRuntimeType(value: TiledPropertyValue, type: TiledPropertyType): boolean {
  switch (type) {
    case 'string':
    case 'color':
    case 'file':
      return typeof value === 'string'
    case 'int':
    case 'float':
    case 'object':
      return typeof value === 'number'
    case 'bool':
      return typeof value === 'boolean'
    default:
      return true
  }
}
