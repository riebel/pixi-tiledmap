import type {
  ParseOptions,
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
  TiledChunk,
  TiledDrawOrder,
  TiledLayer,
  TiledMap,
  TiledObject,
  TiledObjectTemplate,
  TiledRenderOrder,
  TiledTileDefinition,
  TiledTileset,
  TiledTilesetRef
} from '../types'
import { decodeLayerData, decodeLayerDataAsync } from './decodeData.js'
import { decodeGid } from './decodeGid.js'
import { mergeTemplate } from './mergeTemplate.js'
import { computeTilesetColumns, findTilesetIndexForGid, isTilesetRef } from './tilesetHelpers.js'

// ─── Resolve tileset ─────────────────────────────────────────────────────────

function resolveTileset(raw: TiledTileset, source?: string): ResolvedTileset {
  const tiles = new Map<number, TiledTileDefinition>()
  if (raw.tiles) {
    for (const tile of raw.tiles) {
      tiles.set(tile.id, tile)
    }
  }

  return {
    firstgid: raw.firstgid,
    name: raw.name,
    source,
    tilewidth: raw.tilewidth,
    tileheight: raw.tileheight,
    columns: computeTilesetColumns(raw),
    tilecount: raw.tilecount,
    margin: raw.margin,
    spacing: raw.spacing,
    image: raw.image,
    imagewidth: raw.imagewidth,
    imageheight: raw.imageheight,
    tileoffset: raw.tileoffset ?? { x: 0, y: 0 },
    objectalignment: raw.objectalignment ?? 'unspecified',
    tilerendersize: raw.tilerendersize ?? 'tile',
    fillmode: raw.fillmode ?? 'stretch',
    tiles,
    properties: raw.properties ?? [],
    transformations: raw.transformations,
    grid: raw.grid,
    wangsets: raw.wangsets,
    terrains: raw.terrains
  }
}

// ─── Resolve tile data ───────────────────────────────────────────────────────

function resolveGids(rawGids: number[], tilesets: ResolvedTileset[]): (ResolvedTile | null)[] {
  const result: (ResolvedTile | null)[] = new Array(rawGids.length)

  for (let i = 0; i < rawGids.length; i++) {
    result[i] = resolveTileGid(rawGids[i], tilesets)
  }

  return result
}

function resolveTileGid(
  rawGid: number | undefined,
  tilesets: ResolvedTileset[],
  options?: { requireTileset: boolean }
): ResolvedTile | null {
  if (rawGid === undefined || rawGid === 0) return null

  const decoded = decodeGid(rawGid)
  if (!decoded) return null

  const tsIdx = findTilesetIndexForGid(decoded.gid, tilesets)
  const ts = tsIdx >= 0 ? tilesets[tsIdx] : undefined
  if (!ts) return options?.requireTileset ? null : decoded

  decoded.tilesetIndex = tsIdx
  decoded.localId = decoded.gid - ts.firstgid
  return decoded
}

// ─── Layer defaults ──────────────────────────────────────────────────────────

function layerDefaults(layer: TiledLayer) {
  return {
    id: layer.id,
    name: layer.name,
    opacity: layer.opacity,
    visible: layer.visible,
    offsetx: layer.offsetx ?? 0,
    offsety: layer.offsety ?? 0,
    parallaxx: layer.parallaxx ?? 1,
    parallaxy: layer.parallaxy ?? 1,
    tintcolor: layer.tintcolor,
    properties: layer.properties ?? []
  }
}

function resolveObjects(
  objects: TiledObject[],
  tilesets: ResolvedTileset[],
  templates?: Map<string, TiledObjectTemplate>
): ResolvedObject[] {
  return objects.map((raw): ResolvedObject => {
    let merged: TiledObject = raw
    if (raw.template && templates) {
      const tpl = templates.get(raw.template)
      if (tpl) merged = mergeTemplate(raw, tpl, tilesets)
    }

    const { gid, template: _template, ...rest } = merged
    const resolved: ResolvedObject = rest

    if (gid !== undefined) {
      const tile = resolveTileGid(gid, tilesets, { requireTileset: true })
      if (tile) resolved.tile = tile
    }

    return resolved
  })
}

// ─── Shared non-tilelayer resolution (sync -no data decoding needed) ───────

function resolveImageLayer(layer: TiledLayer): ResolvedImageLayer {
  return {
    type: 'imagelayer',
    ...layerDefaults(layer),
    image: layer.image ?? '',
    imagewidth: layer.imagewidth,
    imageheight: layer.imageheight,
    repeatx: layer.repeatx ?? false,
    repeaty: layer.repeaty ?? false,
    transparentcolor: layer.transparentcolor
  }
}

function resolveObjectLayer(
  layer: TiledLayer,
  tilesets: ResolvedTileset[],
  templates?: Map<string, TiledObjectTemplate>
): ResolvedObjectLayer {
  return {
    type: 'objectgroup',
    ...layerDefaults(layer),
    draworder: (layer.draworder ?? 'topdown') as TiledDrawOrder,
    objects: resolveObjects(layer.objects ?? [], tilesets, templates)
  }
}

function resolveTileLayerBase(layer: TiledLayer) {
  return {
    type: 'tilelayer' as const,
    ...layerDefaults(layer),
    width: layer.width ?? 0,
    height: layer.height ?? 0
  }
}

// ─── Resolve layers (sync) ──────────────────────────────────────────────────

function resolveLayer(
  layer: TiledLayer,
  tilesets: ResolvedTileset[],
  templates?: Map<string, TiledObjectTemplate>
): ResolvedLayer {
  switch (layer.type) {
    case 'tilelayer':
      return resolveTileLayerSync(layer, tilesets)

    default:
      return resolveNonTileLayer(layer, tilesets, templates, (child) =>
        resolveLayer(child, tilesets, templates)
      )
  }
}

// ─── Resolve layers (async -needed for compressed data) ─────────────────────

async function resolveLayerAsync(
  layer: TiledLayer,
  tilesets: ResolvedTileset[],
  templates?: Map<string, TiledObjectTemplate>
): Promise<ResolvedLayer> {
  switch (layer.type) {
    case 'tilelayer':
      return resolveTileLayerAsync(layer, tilesets)

    default:
      return resolveNonTileLayerAsync(layer, tilesets, templates)
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function parseMap(data: TiledMap, options?: ParseOptions): ResolvedMap {
  const resolvedTilesets = resolveTilesets(data.tilesets, options)
  const layers = data.layers.map((l) => resolveLayer(l, resolvedTilesets, options?.templates))

  return buildResolvedMap(data, resolvedTilesets, layers)
}

export async function parseMapAsync(data: TiledMap, options?: ParseOptions): Promise<ResolvedMap> {
  const resolvedTilesets = resolveTilesets(data.tilesets, options)
  const layers = await Promise.all(
    data.layers.map((l) => resolveLayerAsync(l, resolvedTilesets, options?.templates))
  )

  return buildResolvedMap(data, resolvedTilesets, layers)
}

// ─── Chunk resolution ────────────────────────────────────────────────────────

function resolveChunksSync(
  chunks: TiledChunk[],
  encoding: TiledLayer['encoding'],
  compression: TiledLayer['compression'],
  tilesets: ResolvedTileset[]
): ResolvedChunk[] {
  return chunks.map((chunk) => {
    const rawGids = decodeLayerData(chunk.data, encoding, compression)
    return {
      x: chunk.x,
      y: chunk.y,
      width: chunk.width,
      height: chunk.height,
      tiles: resolveGids(rawGids, tilesets)
    }
  })
}

async function resolveChunksAsync(
  chunks: TiledChunk[],
  encoding: TiledLayer['encoding'],
  compression: TiledLayer['compression'],
  tilesets: ResolvedTileset[]
): Promise<ResolvedChunk[]> {
  return Promise.all(
    chunks.map(async (chunk) => {
      const rawGids = await decodeLayerDataAsync(chunk.data, encoding, compression)
      return {
        x: chunk.x,
        y: chunk.y,
        width: chunk.width,
        height: chunk.height,
        tiles: resolveGids(rawGids, tilesets)
      }
    })
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveTilesets(
  raw: (TiledTileset | TiledTilesetRef)[],
  options?: ParseOptions
): ResolvedTileset[] {
  return raw.map((ts) => {
    if (isTilesetRef(ts)) {
      const external = options?.externalTilesets?.get(ts.source)
      if (!external) {
        throw new Error(
          `External tileset "${ts.source}" not provided. Pass it via options.externalTilesets.`
        )
      }
      return resolveTileset({ ...external, firstgid: ts.firstgid }, ts.source)
    }
    return resolveTileset(ts)
  })
}

function resolveTileLayerSync(layer: TiledLayer, tilesets: ResolvedTileset[]): ResolvedTileLayer {
  if (layer.chunks && layer.chunks.length > 0) {
    return resolveInfiniteTileLayer(
      layer,
      resolveChunksSync(layer.chunks, layer.encoding, layer.compression, tilesets)
    )
  }

  return resolveFiniteTileLayer(
    layer,
    decodeLayerData(layer.data ?? [], layer.encoding, layer.compression),
    tilesets
  )
}

async function resolveTileLayerAsync(
  layer: TiledLayer,
  tilesets: ResolvedTileset[]
): Promise<ResolvedTileLayer> {
  if (layer.chunks && layer.chunks.length > 0) {
    return resolveInfiniteTileLayer(
      layer,
      await resolveChunksAsync(layer.chunks, layer.encoding, layer.compression, tilesets)
    )
  }

  return resolveFiniteTileLayer(
    layer,
    await decodeLayerDataAsync(layer.data ?? [], layer.encoding, layer.compression),
    tilesets
  )
}

function resolveFiniteTileLayer(
  layer: TiledLayer,
  rawGids: number[],
  tilesets: ResolvedTileset[]
): ResolvedTileLayer {
  return {
    ...resolveTileLayerBase(layer),
    infinite: false,
    tiles: resolveGids(rawGids, tilesets)
  }
}

function resolveInfiniteTileLayer(layer: TiledLayer, chunks: ResolvedChunk[]): ResolvedTileLayer {
  return {
    ...resolveTileLayerBase(layer),
    infinite: true,
    tiles: [],
    chunks
  }
}

function resolveNonTileLayer(
  layer: TiledLayer,
  tilesets: ResolvedTileset[],
  templates: Map<string, TiledObjectTemplate> | undefined,
  resolveChild: (layer: TiledLayer) => ResolvedLayer
): ResolvedLayer {
  switch (layer.type) {
    case 'imagelayer':
      return resolveImageLayer(layer)

    case 'objectgroup':
      return resolveObjectLayer(layer, tilesets, templates)

    case 'group':
      return {
        type: 'group',
        ...layerDefaults(layer),
        layers: (layer.layers ?? []).map(resolveChild)
      } satisfies ResolvedGroupLayer

    case 'tilelayer':
      throw new Error('resolveNonTileLayer received a tile layer')

    default:
      return assertUnhandledLayer(layer)
  }
}

async function resolveNonTileLayerAsync(
  layer: TiledLayer,
  tilesets: ResolvedTileset[],
  templates?: Map<string, TiledObjectTemplate>
): Promise<ResolvedLayer> {
  if (layer.type !== 'group') {
    return resolveNonTileLayer(layer, tilesets, templates, (child) =>
      resolveLayer(child, tilesets, templates)
    )
  }

  const resolvedChildren = await Promise.all(
    (layer.layers ?? []).map((l) => resolveLayerAsync(l, tilesets, templates))
  )
  return {
    type: 'group',
    ...layerDefaults(layer),
    layers: resolvedChildren
  } satisfies ResolvedGroupLayer
}

function assertUnhandledLayer(layer: TiledLayer): never {
  throw new Error(`Unhandled layer type: ${(layer as TiledLayer).type}`)
}

function buildResolvedMap(
  data: TiledMap,
  tilesets: ResolvedTileset[],
  layers: ResolvedLayer[]
): ResolvedMap {
  return {
    orientation: data.orientation,
    renderorder: (data.renderorder ?? 'right-down') as TiledRenderOrder,
    width: data.width,
    height: data.height,
    tilewidth: data.tilewidth,
    tileheight: data.tileheight,
    infinite: data.infinite,
    backgroundcolor: data.backgroundcolor,
    hexsidelength: data.hexsidelength,
    staggeraxis: data.staggeraxis,
    staggerindex: data.staggerindex,
    parallaxoriginx: data.parallaxoriginx ?? 0,
    parallaxoriginy: data.parallaxoriginy ?? 0,
    properties: data.properties ?? [],
    tilesets,
    layers,
    version: data.version,
    tiledversion: data.tiledversion
  }
}
