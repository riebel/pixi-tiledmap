import {
  type ResolvedObjectDefaultInput,
  resolvedLayerDefaults,
  resolvedMapDefaults,
  resolvedObjectDefaults,
  resolvedTilesetDefaults
} from './resolvedDefaults.js'
import { resolveTileInput } from './resolvedTile.js'
import type {
  ResolvedChunk,
  ResolvedGroupLayer,
  ResolvedImageLayer,
  ResolvedLayer,
  ResolvedMap,
  ResolvedObject,
  ResolvedObjectLayer,
  ResolvedTile,
  ResolvedTileLayer,
  ResolvedTileset,
  TiledDrawOrder,
  TiledFillMode,
  TiledObjectAlignment,
  TiledProperty,
  TiledRenderOrder,
  TiledTileDefinition,
  TiledTileInput,
  TiledTileOffset,
  TiledTileRenderSize
} from './types/index.js'

export interface CreateMapOptions {
  width: number
  height: number
  tilewidth: number
  tileheight: number
  tilesets?: CreateTilesetOptions[]
  layers?: CreateLayerOptions[]
  orientation?: ResolvedMap['orientation']
  renderorder?: TiledRenderOrder
  infinite?: boolean
  backgroundcolor?: string
  parallaxoriginx?: number
  parallaxoriginy?: number
  properties?: TiledProperty[]
  version?: string
  tiledversion?: string
}

export interface CreateTilesetOptions {
  name: string
  firstgid?: number
  source?: string
  tilewidth: number
  tileheight: number
  columns?: number
  tilecount: number
  margin?: number
  spacing?: number
  image?: string
  imagewidth?: number
  imageheight?: number
  tileoffset?: TiledTileOffset
  objectalignment?: TiledObjectAlignment
  tilerendersize?: TiledTileRenderSize
  fillmode?: TiledFillMode
  tiles?: TiledTileDefinition[] | Map<number, TiledTileDefinition>
  properties?: TiledProperty[]
}

export type CreateLayerOptions =
  | CreateTileLayerOptions
  | CreateImageLayerOptions
  | CreateObjectLayerOptions
  | CreateGroupLayerOptions

interface CreateLayerBaseOptions {
  id?: number
  name: string
  opacity?: number
  visible?: boolean
  offsetx?: number
  offsety?: number
  parallaxx?: number
  parallaxy?: number
  tintcolor?: string
  properties?: TiledProperty[]
}

export interface CreateTileLayerOptions extends CreateLayerBaseOptions {
  type?: 'tilelayer'
  width?: number
  height?: number
  tiles?: TiledTileInput[]
  chunks?: CreateChunkOptions[]
}

export interface CreateChunkOptions {
  x: number
  y: number
  width: number
  height: number
  tiles: TiledTileInput[]
}

export interface CreateImageLayerOptions extends CreateLayerBaseOptions {
  type: 'imagelayer'
  image: string
  imagewidth?: number
  imageheight?: number
  repeatx?: boolean
  repeaty?: boolean
  transparentcolor?: string
}

/**
 * A tile object's `tile` accepts the same input a tile layer's cells do, so a
 * caller can write `{ tile: { tileset: 'objects', tileId: 3 } }` and let the
 * library derive the GID and tileset index. A fully built `ResolvedTile` is
 * still accepted.
 */
export interface CreateObjectOptions extends ResolvedObjectDefaultInput {
  tile?: TiledTileInput
}

export interface CreateObjectLayerOptions extends CreateLayerBaseOptions {
  type: 'objectgroup'
  draworder?: TiledDrawOrder
  objects?: CreateObjectOptions[]
}

export interface CreateGroupLayerOptions extends CreateLayerBaseOptions {
  type: 'group'
  layers?: CreateLayerOptions[]
}

interface LayerIdAllocator {
  next: number
}

export function createMap(options: CreateMapOptions): ResolvedMap {
  const tilesets = createTilesets(options.tilesets ?? [])
  const ids: LayerIdAllocator = { next: 1 }
  const layers = (options.layers ?? []).map((layer) =>
    createLayer(layer, {
      mapWidth: options.width,
      mapHeight: options.height,
      tilesets,
      ids
    })
  )

  return {
    ...resolvedMapDefaults(options, '1.10'),
    backgroundcolor: options.backgroundcolor,
    tilesets,
    layers,
    tiledversion: options.tiledversion
  }
}

export function createTileset(options: CreateTilesetOptions): ResolvedTileset {
  const tiles =
    options.tiles instanceof Map
      ? new Map(options.tiles)
      : new Map((options.tiles ?? []).map((tile) => [tile.id, tile]))

  return {
    ...resolvedTilesetDefaults({
      ...options,
      tileDefinitionCount: tiles.size
    }),
    source: options.source,
    image: options.image,
    imagewidth: options.imagewidth,
    imageheight: options.imageheight,
    tiles
  }
}

export function createTileLayer(
  options: CreateTileLayerOptions,
  tilesets: ResolvedTileset[] = [],
  mapSize?: { width: number; height: number }
): ResolvedTileLayer {
  const width = options.width ?? mapSize?.width ?? 0
  const height = options.height ?? mapSize?.height ?? 0
  const base = {
    type: 'tilelayer' as const,
    ...layerDefaults(options, options.id ?? 1),
    width,
    height
  }

  if (options.chunks) {
    return {
      ...base,
      infinite: true,
      tiles: [],
      chunks: options.chunks.map((chunk): ResolvedChunk => {
        assertTileCount(chunk.tiles, chunk.width, chunk.height, `chunk (${chunk.x}, ${chunk.y})`)
        return {
          x: chunk.x,
          y: chunk.y,
          width: chunk.width,
          height: chunk.height,
          tiles: chunk.tiles.map((tile) => resolveTileInput(tile, tilesets))
        }
      })
    }
  }

  const tiles = options.tiles ?? new Array(width * height).fill(null)
  assertTileCount(tiles, width, height, options.name)
  return {
    ...base,
    infinite: false,
    tiles: tiles.map((tile) => resolveTileInput(tile, tilesets))
  }
}

export function createImageLayer(options: CreateImageLayerOptions): ResolvedImageLayer {
  return {
    type: 'imagelayer',
    ...layerDefaults(options, options.id ?? 1),
    image: options.image,
    imagewidth: options.imagewidth,
    imageheight: options.imageheight,
    repeatx: options.repeatx ?? false,
    repeaty: options.repeaty ?? false,
    transparentcolor: options.transparentcolor
  }
}

export function createObjectLayer(
  options: CreateObjectLayerOptions,
  tilesets: ResolvedTileset[] = []
): ResolvedObjectLayer {
  return {
    type: 'objectgroup',
    ...layerDefaults(options, options.id ?? 1),
    draworder: options.draworder ?? 'topdown',
    objects: (options.objects ?? []).map((object) => createObject(object, tilesets))
  }
}

function createObject(options: CreateObjectOptions, tilesets: ResolvedTileset[]): ResolvedObject {
  const object = resolvedObjectDefaults(options)
  const tile = resolveObjectTile(options.tile, tilesets)
  if (tile) object.tile = tile
  return object
}

/**
 * An already-resolved tile is taken as authoritative rather than re-resolved.
 * Re-resolving would be a no-op when it was built against these same tilesets,
 * and would throw when the caller passed none - which is what every caller did
 * before this function accepted tilesets at all.
 */
function resolveObjectTile(
  input: TiledTileInput | undefined,
  tilesets: ResolvedTileset[]
): ResolvedTile | null {
  if (input === undefined || input === null) return null
  if (isResolvedTile(input)) return input
  return resolveTileInput(input, tilesets)
}

function isResolvedTile(input: TiledTileInput): input is ResolvedTile {
  return typeof input === 'object' && input !== null && 'tilesetIndex' in input
}

export function createGroupLayer(
  options: CreateGroupLayerOptions,
  tilesets: ResolvedTileset[] = [],
  mapSize?: { width: number; height: number }
): ResolvedGroupLayer {
  const ids: LayerIdAllocator = { next: (options.id ?? 1) + 1 }
  return {
    type: 'group',
    ...layerDefaults(options, options.id ?? 1),
    layers: (options.layers ?? []).map((layer) =>
      createLayer(layer, {
        mapWidth: mapSize?.width ?? 0,
        mapHeight: mapSize?.height ?? 0,
        tilesets,
        ids
      })
    )
  }
}

function createTilesets(options: CreateTilesetOptions[]): ResolvedTileset[] {
  let nextFirstGid = 1
  return options.map((tilesetOptions) => {
    const tileset = createTileset({
      ...tilesetOptions,
      firstgid: tilesetOptions.firstgid ?? nextFirstGid
    })
    nextFirstGid = tileset.firstgid + tileset.tilecount
    return tileset
  })
}

function createLayer(
  options: CreateLayerOptions,
  context: {
    mapWidth: number
    mapHeight: number
    tilesets: ResolvedTileset[]
    ids: LayerIdAllocator
  }
): ResolvedLayer {
  const withId = { ...options, id: options.id ?? context.ids.next++ } as CreateLayerOptions
  switch (withId.type) {
    case undefined:
    case 'tilelayer':
      return createTileLayer(withId, context.tilesets, {
        width: context.mapWidth,
        height: context.mapHeight
      })
    case 'imagelayer':
      return createImageLayer(withId)
    case 'objectgroup':
      return createObjectLayer(withId, context.tilesets)
    case 'group':
      return {
        type: 'group',
        ...layerDefaults(withId, withId.id ?? 1),
        layers: (withId.layers ?? []).map((layer) => createLayer(layer, context))
      }
    default:
      return assertNever(withId)
  }
}

function layerDefaults(options: CreateLayerBaseOptions, id: number) {
  return resolvedLayerDefaults(options, id)
}

function assertTileCount(
  tiles: TiledTileInput[],
  width: number,
  height: number,
  label: string
): void {
  const expected = width * height
  if (tiles.length !== expected) {
    throw new RangeError(
      `Tile layer "${label}" expected ${expected} tiles, received ${tiles.length}.`
    )
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled layer type: ${(value as { type?: string }).type}`)
}
