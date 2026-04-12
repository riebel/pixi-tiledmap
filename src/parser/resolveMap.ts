import type {
  ParseOptions,
  ResolvedChunk,
  ResolvedGroupLayer,
  ResolvedImageLayer,
  ResolvedLayer,
  ResolvedMap,
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

// ─── Tileset ref check ───────────────────────────────────────────────────────

function isTilesetRef(ts: TiledTileset | TiledTilesetRef): ts is TiledTilesetRef {
  return 'source' in ts && !('name' in ts)
}

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
    columns:
      raw.columns > 0
        ? raw.columns
        : raw.imagewidth && raw.tilewidth > 0
          ? Math.floor(
              (raw.imagewidth - 2 * raw.margin + raw.spacing) / (raw.tilewidth + raw.spacing)
            )
          : 0,
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

// ─── Find tileset for GID ────────────────────────────────────────────────────

function findTilesetIndex(gid: number, tilesets: ResolvedTileset[]): number {
  for (let i = tilesets.length - 1; i >= 0; i--) {
    const ts = tilesets[i]
    if (ts && ts.firstgid <= gid) {
      return i
    }
  }
  return 0
}

// ─── Resolve tile data ───────────────────────────────────────────────────────

function resolveGids(rawGids: number[], tilesets: ResolvedTileset[]): (ResolvedTile | null)[] {
  const result: (ResolvedTile | null)[] = new Array(rawGids.length)

  for (let i = 0; i < rawGids.length; i++) {
    const rawGid = rawGids[i]
    if (rawGid === undefined || rawGid === 0) {
      result[i] = null
      continue
    }

    const decoded = decodeGid(rawGid)
    if (!decoded) {
      result[i] = null
      continue
    }

    const tsIdx = findTilesetIndex(decoded.gid, tilesets)
    const ts = tilesets[tsIdx]
    if (ts) {
      decoded.tilesetIndex = tsIdx
      decoded.localId = decoded.gid - ts.firstgid
    }
    result[i] = decoded
  }

  return result
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

// ─── Template merging ────────────────────────────────────────────────────────

function mergeTemplate(
  obj: TiledObject,
  template: TiledObjectTemplate,
  tilesets: ResolvedTileset[]
): TiledObject {
  // Start from the template's object, then override with the instance's
  // own fields (only the ones explicitly set — Tiled stores only deltas).
  const base: TiledObject = {
    ...template.object,
    id: obj.id,
    // Non-optional fields on the instance always win when present in TiledObject.
    x: obj.x,
    y: obj.y,
    rotation: obj.rotation,
    visible: obj.visible
  }

  // name / type are strings on TiledObject with no explicit "unset" sentinel.
  // Prefer the instance only when it provided a non-empty value.
  if (obj.name) base.name = obj.name
  if (obj.type) base.type = obj.type
  if (obj.width) base.width = obj.width
  if (obj.height) base.height = obj.height
  if (obj.properties) base.properties = obj.properties
  if (obj.text) base.text = obj.text
  if (obj.gid !== undefined) base.gid = obj.gid
  if (obj.polygon) base.polygon = obj.polygon
  if (obj.polyline) base.polyline = obj.polyline
  if (obj.ellipse) base.ellipse = obj.ellipse
  if (obj.point) base.point = obj.point

  // GID remapping: the template's gid is relative to the template's own
  // embedded tileset firstgid. If the template carried a tileset ref and
  // the map has the same tileset (matched by source), translate the gid
  // into the map's firstgid space so it points at the right tile.
  if (
    base.gid !== undefined &&
    template.tileset &&
    'source' in template.tileset &&
    template.tileset.source
  ) {
    const src = template.tileset.source
    const mapTs = tilesets.find((t) => t.source === src)
    if (mapTs) {
      const templateFirstGid = template.tileset.firstgid ?? 1
      // Preserve flip flags in the high bits.
      const flipBits = base.gid & ~GID_VALUE_MASK
      const localId = (base.gid & GID_VALUE_MASK) - templateFirstGid
      if (localId >= 0) {
        base.gid = (mapTs.firstgid + localId) | flipBits
      }
    }
  }

  return base
}

const GID_VALUE_MASK = 0x0fffffff

function resolveObjects(
  objects: TiledObject[],
  tilesets: ResolvedTileset[],
  templates?: Map<string, TiledObjectTemplate>
): TiledObject[] {
  if (!templates || templates.size === 0) return objects
  return objects.map((obj) => {
    if (!obj.template) return obj
    const tpl = templates.get(obj.template)
    if (!tpl) return obj
    return mergeTemplate(obj, tpl, tilesets)
  })
}

// ─── Resolve layers (sync) ──────────────────────────────────────────────────

function resolveLayer(
  layer: TiledLayer,
  tilesets: ResolvedTileset[],
  templates?: Map<string, TiledObjectTemplate>
): ResolvedLayer {
  switch (layer.type) {
    case 'tilelayer': {
      const hasChunks = layer.chunks && layer.chunks.length > 0

      if (hasChunks) {
        const resolvedChunks = resolveChunksSync(
          layer.chunks!,
          layer.encoding,
          layer.compression,
          tilesets
        )
        return {
          type: 'tilelayer',
          ...layerDefaults(layer),
          width: layer.width ?? 0,
          height: layer.height ?? 0,
          infinite: true,
          tiles: [],
          chunks: resolvedChunks
        } satisfies ResolvedTileLayer
      }

      const rawGids = decodeLayerData(layer.data ?? [], layer.encoding, layer.compression)
      const tiles = resolveGids(rawGids, tilesets)
      return {
        type: 'tilelayer',
        ...layerDefaults(layer),
        width: layer.width ?? 0,
        height: layer.height ?? 0,
        infinite: false,
        tiles
      } satisfies ResolvedTileLayer
    }

    case 'imagelayer':
      return {
        type: 'imagelayer',
        ...layerDefaults(layer),
        image: layer.image ?? '',
        imagewidth: layer.imagewidth,
        imageheight: layer.imageheight,
        repeatx: layer.repeatx ?? false,
        repeaty: layer.repeaty ?? false,
        transparentcolor: layer.transparentcolor
      } satisfies ResolvedImageLayer

    case 'objectgroup':
      return {
        type: 'objectgroup',
        ...layerDefaults(layer),
        draworder: (layer.draworder ?? 'topdown') as TiledDrawOrder,
        objects: resolveObjects(layer.objects ?? [], tilesets, templates)
      } satisfies ResolvedObjectLayer

    case 'group':
      return {
        type: 'group',
        ...layerDefaults(layer),
        layers: (layer.layers ?? []).map((l) => resolveLayer(l, tilesets, templates))
      } satisfies ResolvedGroupLayer
  }
}

// ─── Resolve layers (async — needed for compressed data) ─────────────────────

async function resolveLayerAsync(
  layer: TiledLayer,
  tilesets: ResolvedTileset[],
  templates?: Map<string, TiledObjectTemplate>
): Promise<ResolvedLayer> {
  switch (layer.type) {
    case 'tilelayer': {
      const hasChunks = layer.chunks && layer.chunks.length > 0

      if (hasChunks) {
        const resolvedChunks = await resolveChunksAsync(
          layer.chunks!,
          layer.encoding,
          layer.compression,
          tilesets
        )
        return {
          type: 'tilelayer',
          ...layerDefaults(layer),
          width: layer.width ?? 0,
          height: layer.height ?? 0,
          infinite: true,
          tiles: [],
          chunks: resolvedChunks
        } satisfies ResolvedTileLayer
      }

      const rawGids = await decodeLayerDataAsync(
        layer.data ?? [],
        layer.encoding,
        layer.compression
      )
      const tiles = resolveGids(rawGids, tilesets)
      return {
        type: 'tilelayer',
        ...layerDefaults(layer),
        width: layer.width ?? 0,
        height: layer.height ?? 0,
        infinite: false,
        tiles
      } satisfies ResolvedTileLayer
    }

    case 'imagelayer':
      return {
        type: 'imagelayer',
        ...layerDefaults(layer),
        image: layer.image ?? '',
        imagewidth: layer.imagewidth,
        imageheight: layer.imageheight,
        repeatx: layer.repeatx ?? false,
        repeaty: layer.repeaty ?? false,
        transparentcolor: layer.transparentcolor
      } satisfies ResolvedImageLayer

    case 'objectgroup':
      return {
        type: 'objectgroup',
        ...layerDefaults(layer),
        draworder: (layer.draworder ?? 'topdown') as TiledDrawOrder,
        objects: resolveObjects(layer.objects ?? [], tilesets, templates)
      } satisfies ResolvedObjectLayer

    case 'group': {
      const resolvedChildren = await Promise.all(
        (layer.layers ?? []).map((l) => resolveLayerAsync(l, tilesets, templates))
      )
      return {
        type: 'group',
        ...layerDefaults(layer),
        layers: resolvedChildren
      } satisfies ResolvedGroupLayer
    }
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
