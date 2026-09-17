import type {
  ResolvedLayer,
  TiledClassValue,
  TiledListItem,
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
 * The JavaScript type each Tiled property type carries. A `class` value's
 * members are author-defined, so they stay loosely typed.
 */
export interface TiledPropertyValueByType {
  string: string
  color: string
  file: string
  int: number
  float: number
  object: number
  bool: boolean
  class: TiledClassValue
  list: TiledListItem[]
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

const isString = (value: TiledPropertyValue) => typeof value === 'string'
const isNumber = (value: TiledPropertyValue) => typeof value === 'number'

const RUNTIME_TYPE_CHECKS: Record<TiledPropertyType, (value: TiledPropertyValue) => boolean> = {
  string: isString,
  color: isString,
  file: isString,
  int: isNumber,
  float: isNumber,
  object: isNumber,
  bool: (value) => typeof value === 'boolean',
  class: (value) => typeof value === 'object' && value !== null && !Array.isArray(value),
  list: (value) => Array.isArray(value)
}

function hasRuntimeType(value: TiledPropertyValue, type: TiledPropertyType): boolean {
  return RUNTIME_TYPE_CHECKS[type]?.(value) ?? true
}
