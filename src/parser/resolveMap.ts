import {
  resolvedLayerDefaults,
  resolvedMapDefaults,
  resolvedObjectDefaults,
  resolvedTilesetDefaults
} from '../resolvedDefaults.js'
import { resolveTileGid as resolveResolvedTileGid } from '../resolvedTile.js'
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
  TiledTileDefinition,
  TiledTileset,
  TiledTilesetRef
} from '../types'
import { decodeLayerData, decodeLayerDataAsync } from './decodeData.js'
import { mergeTemplate } from './mergeTemplate.js'
import { isTilesetRef } from './tilesetHelpers.js'

// ─── Resolve tileset ─────────────────────────────────────────────────────────

function resolveTileset(raw: TiledTileset, source?: string): ResolvedTileset {
  const tiles = new Map<number, TiledTileDefinition>()
  if (raw.tiles) {
    for (const tile of raw.tiles) {
      tiles.set(tile.id, tile)
    }
  }
  const defaults = resolvedTilesetDefaults({
    ...raw,
    tileDefinitionCount: raw.tiles?.length
  })

  return {
    ...defaults,
    source,
    image: raw.image,
    imagewidth: raw.imagewidth,
    imageheight: raw.imageheight,
    tiles,
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
    result[i] = resolveParserTileGid(rawGids[i], tilesets)
  }

  return result
}

function resolveParserTileGid(
  rawGid: number | undefined,
  tilesets: ResolvedTileset[],
  options?: { requireTileset: boolean }
): ResolvedTile | null {
  return resolveResolvedTileGid(rawGid, tilesets, {
    missingTileset: options?.requireTileset ? 'null' : 'decoded'
  })
}

// ─── Layer defaults ──────────────────────────────────────────────────────────

function layerDefaults(layer: TiledLayer) {
  return resolvedLayerDefaults(layer)
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

    const { gid } = merged
    const resolved = resolvedObjectDefaults(merged)

    if (gid !== undefined) {
      const tile = resolveParserTileGid(gid, tilesets, { requireTileset: true })
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
  const resolvedTilesets = resolveTilesets(data.tilesets ?? [], options)
  const layers = (data.layers ?? []).map((l) =>
    resolveLayer(l, resolvedTilesets, options?.templates)
  )

  return buildResolvedMap(data, resolvedTilesets, layers)
}

export async function parseMapAsync(data: TiledMap, options?: ParseOptions): Promise<ResolvedMap> {
  const resolvedTilesets = resolveTilesets(data.tilesets ?? [], options)
  const layers = await Promise.all(
    (data.layers ?? []).map((l) => resolveLayerAsync(l, resolvedTilesets, options?.templates))
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
  const defaults = resolvedMapDefaults(data)

  return {
    ...defaults,
    backgroundcolor: data.backgroundcolor,
    hexsidelength: data.hexsidelength,
    staggeraxis: data.staggeraxis,
    staggerindex: data.staggerindex,
    tilesets,
    layers,
    tiledversion: data.tiledversion
  }
}
