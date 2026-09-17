import { resolveIdCounters } from '../idCounters.js'
import type {
  ResolvedLayer,
  ResolvedMap,
  ResolvedObject,
  ResolvedTile,
  ResolvedTileLayer,
  ResolvedTileset,
  TiledDataCompression,
  TiledEncoding,
  TiledLayer,
  TiledMap,
  TiledObject,
  TiledProperty,
  TiledTileDefinition,
  TiledTileOffset,
  TiledTileset,
  TiledTilesetFile,
  TiledTilesetRef
} from '../types'
import { encodeGid } from './encodeGid.js'

export interface ExportMapOptions {
  /**
   * Tileset name to external source path (`.tsj`/`.tsx`). A tileset named here
   * is written as a `{ firstgid, source }` reference rather than embedded,
   * overriding the tileset's own `source`.
   *
   * By default a tileset is written as a reference when it has a `source` (as
   * every externally-resolved tileset does) and embedded when it does not.
   */
  tilesetSources?: Map<string, string> | Record<string, string>
  /**
   * How to write tile layer data: `'csv'` writes a plain GID array, `'base64'`
   * writes base64. By default each layer keeps the encoding it was parsed or
   * created with, and CSV otherwise.
   *
   * `exportMap` never compresses, since the Compression Streams API has no
   * synchronous form; a compressed layer is written as uncompressed base64.
   * Use `exportMapAsync` to keep or choose a compression.
   */
  encoding?: TiledEncoding
}

export interface ExportMapAsyncOptions extends ExportMapOptions {
  /**
   * How to compress base64 tile data. By default each layer keeps the
   * compression it was parsed or created with; `null` writes every layer
   * uncompressed. A compressed layer is always written as base64.
   */
  compression?: TiledDataCompression | null
}

/** Where a compressed layer's data goes once it is compressed. */
interface PendingCompression {
  target: { data?: number[] | string }
  gids: number[]
  compression: TiledDataCompression
}

interface DataFormat {
  encoding: TiledEncoding
  compression?: TiledDataCompression
}

/**
 * Writes a `ResolvedMap` back out as Tiled JSON: the inverse of `parseMap`.
 *
 * The result is a plain, JSON-serializable `TiledMap`. Re-parsing it yields a
 * map deep-equal to the input, provided any external tilesets it references are
 * passed back through `ParseOptions.externalTilesets`.
 *
 * Two things a `ResolvedMap` can hold have no place in the Tiled format and are
 * therefore not written: `ResolvedTile.alpha` (a runtime render property) and
 * any state the parser itself drops, such as an object's originating template.
 *
 * A layer's `compression` is not written either, because compressing has no
 * synchronous form, so a compressed map re-parses without it. Use
 * `exportMapAsync` for an exact round trip of compressed maps.
 */
export function exportMap(map: ResolvedMap, options?: ExportMapOptions): TiledMap {
  return exportMapWith(map, options, (layer) => ({
    encoding: options?.encoding ?? layer.encoding ?? 'csv'
  }))
}

/**
 * `exportMap` that can also compress tile layer data with gzip or zlib,
 * through the Compression Streams API. Re-parsing the result with
 * `parseMapAsync` yields a map deep-equal to the input, compression included.
 */
export async function exportMapAsync(
  map: ResolvedMap,
  options?: ExportMapAsyncOptions
): Promise<TiledMap> {
  const pending: PendingCompression[] = []
  const tmj = exportMapWith(
    map,
    options,
    (layer) => {
      const compression =
        options?.compression === undefined ? layer.compression : (options.compression ?? undefined)
      if (compression) return { encoding: 'base64', compression }
      return { encoding: options?.encoding ?? layer.encoding ?? 'csv' }
    },
    pending
  )
  await Promise.all(
    pending.map(async ({ target, gids, compression }) => {
      target.data = bytesToBase64(await compressBytes(gidsToBytes(gids), compression))
    })
  )
  return tmj
}

type DataFormatFor = (layer: ResolvedTileLayer) => DataFormat

function exportMapWith(
  map: ResolvedMap,
  options: ExportMapOptions | undefined,
  formatFor: DataFormatFor,
  pending?: PendingCompression[]
): TiledMap {
  const sources = normalizeTilesetSources(options?.tilesetSources)
  const writeLayer = (layer: ResolvedLayer) => exportLayer(layer, formatFor, pending)

  return {
    type: 'map',
    version: map.version,
    ...optional('tiledversion', map.tiledversion),
    orientation: map.orientation,
    renderorder: map.renderorder,
    width: map.width,
    height: map.height,
    tilewidth: map.tilewidth,
    tileheight: map.tileheight,
    infinite: map.infinite,
    ...optional('class', map.class),
    ...optional('compressionlevel', map.compressionlevel),
    ...resolveIdCounters(map, map),
    ...optional('backgroundcolor', map.backgroundcolor),
    ...optional('hexsidelength', map.hexsidelength),
    ...optional('staggeraxis', map.staggeraxis),
    ...optional('staggerindex', map.staggerindex),
    ...optional('skewx', map.skewx),
    ...optional('skewy', map.skewy),
    ...omitDefault('parallaxoriginx', map.parallaxoriginx, 0),
    ...omitDefault('parallaxoriginy', map.parallaxoriginy, 0),
    ...properties(map.properties),
    tilesets: map.tilesets.map((tileset) => exportMapTileset(tileset, sources)),
    layers: map.layers.map(writeLayer)
  }
}

export interface ExportTilesetOptions {
  /**
   * Write the tileset as a standalone `.tsj` file rather than as embedded map
   * data: adds `type: 'tileset'` and omits `firstgid`, which belongs to the
   * referencing map rather than to the tileset file.
   */
  standalone?: boolean
  /** Format version for a standalone file. Defaults to the tileset's own, else `'1.10'`. */
  version?: string
  /** Editor version for a standalone file. Defaults to the tileset's own, else omitted. */
  tiledversion?: string
}

/**
 * Writes a `ResolvedTileset` as Tiled tileset data: embedded map data by
 * default, or a standalone `.tsj` file with `{ standalone: true }`.
 *
 * The tileset's `source` is deliberately never written: a source path describes
 * the *reference* to a tileset, not the tileset itself.
 *
 * A `ResolvedTileset` carries no format version, so a standalone file takes one
 * from the options.
 */
export function exportTileset(tileset: ResolvedTileset): TiledTileset
export function exportTileset(
  tileset: ResolvedTileset,
  options: ExportTilesetOptions & { standalone: true }
): TiledTilesetFile
export function exportTileset(
  tileset: ResolvedTileset,
  options?: ExportTilesetOptions
): TiledTileset | TiledTilesetFile
export function exportTileset(
  tileset: ResolvedTileset,
  options?: ExportTilesetOptions
): TiledTileset | TiledTilesetFile {
  if (!options?.standalone) return { firstgid: tileset.firstgid, ...exportTilesetBody(tileset) }

  return {
    type: 'tileset',
    version: options.version ?? tileset.version ?? '1.10',
    ...optional('tiledversion', options.tiledversion ?? tileset.tiledversion),
    ...exportTilesetBody(tileset)
  }
}

/** Everything both the embedded and the standalone form share. */
function exportTilesetBody(tileset: ResolvedTileset): TiledTilesetFile {
  return {
    name: tileset.name,
    ...optional('class', tileset.class),
    tilewidth: tileset.tilewidth,
    tileheight: tileset.tileheight,
    columns: tileset.columns,
    tilecount: tileset.tilecount,
    margin: tileset.margin,
    spacing: tileset.spacing,
    ...optional('image', tileset.image),
    ...optional('imagewidth', tileset.imagewidth),
    ...optional('imageheight', tileset.imageheight),
    ...optional('transparentcolor', tileset.transparentcolor),
    ...optional('backgroundcolor', tileset.backgroundcolor),
    ...(isZeroOffset(tileset.tileoffset) ? {} : { tileoffset: { ...tileset.tileoffset } }),
    ...omitDefault('objectalignment', tileset.objectalignment, 'unspecified'),
    ...omitDefault('tilerendersize', tileset.tilerendersize, 'tile'),
    ...omitDefault('fillmode', tileset.fillmode, 'stretch'),
    ...(tileset.tiles.size > 0 ? { tiles: exportTileDefinitions(tileset.tiles) } : {}),
    ...properties(tileset.properties),
    ...optional('transformations', tileset.transformations),
    ...optional('grid', tileset.grid),
    ...optional('wangsets', tileset.wangsets),
    ...optional('terrains', tileset.terrains)
  }
}

function exportMapTileset(
  tileset: ResolvedTileset,
  sources: Map<string, string> | undefined
): TiledTileset | TiledTilesetRef {
  const source = sources?.get(tileset.name) ?? tileset.source
  if (source !== undefined) return { firstgid: tileset.firstgid, source }
  return exportTileset(tileset)
}

function exportTileDefinitions(tiles: Map<number, TiledTileDefinition>): TiledTileDefinition[] {
  return [...tiles.values()].sort((a, b) => a.id - b.id)
}

function exportLayer(
  layer: ResolvedLayer,
  formatFor: DataFormatFor,
  pending: PendingCompression[] | undefined
): TiledLayer {
  const common = exportLayerCommon(layer)

  switch (layer.type) {
    case 'tilelayer':
      return writeTileLayerData(
        { ...common, type: 'tilelayer', width: layer.width, height: layer.height },
        layer,
        formatFor(layer),
        pending
      )
    case 'imagelayer':
      return {
        ...common,
        type: 'imagelayer',
        image: layer.image,
        ...optional('imagewidth', layer.imagewidth),
        ...optional('imageheight', layer.imageheight),
        ...omitDefault('repeatx', layer.repeatx, false),
        ...omitDefault('repeaty', layer.repeaty, false),
        ...optional('transparentcolor', layer.transparentcolor)
      }
    case 'objectgroup':
      return {
        ...common,
        type: 'objectgroup',
        ...optional('color', layer.color),
        ...omitDefault('draworder', layer.draworder, 'topdown'),
        objects: layer.objects.map(exportObject)
      }
    case 'group':
      return {
        ...common,
        type: 'group',
        layers: layer.layers.map((child) => exportLayer(child, formatFor, pending))
      }
  }
}

function exportLayerCommon(layer: ResolvedLayer) {
  return {
    id: layer.id,
    name: layer.name,
    ...optional('class', layer.class),
    // Tiled writes x/y on every layer and they are always 0; layer placement
    // travels through offsetx/offsety, which is what the parser reads.
    x: 0,
    y: 0,
    opacity: layer.opacity,
    visible: layer.visible,
    ...omitDefault('offsetx', layer.offsetx, 0),
    ...omitDefault('offsety', layer.offsety, 0),
    ...omitDefault('parallaxx', layer.parallaxx, 1),
    ...omitDefault('parallaxy', layer.parallaxy, 1),
    ...optional('tintcolor', layer.tintcolor),
    ...optional('mode', layer.mode),
    ...optional('locked', layer.locked),
    ...properties(layer.properties)
  }
}

/** Adds the tile data fields to `target`, the exported layer itself. */
function writeTileLayerData(
  target: TiledLayer,
  layer: ResolvedTileLayer,
  format: DataFormat,
  pending: PendingCompression[] | undefined
): TiledLayer {
  // A compression only exists where something will carry it out.
  const compression = pending ? format.compression : undefined
  const encoding = compression ? 'base64' : format.encoding
  // A GID array needs no `encoding` field; that is how Tiled writes CSV to JSON.
  const fields = {
    ...(encoding === 'base64' ? { encoding } : {}),
    ...(compression ? { compression } : {})
  }

  // Compression happens later, so remember the object whose `data` it replaces.
  const withData = <T extends object>(target: T, tiles: readonly (ResolvedTile | null)[]) => {
    const written = Object.assign(target, { data: encodeTiles(tiles, encoding) })
    if (compression && pending) {
      pending.push({ target: written, gids: tiles.map((tile) => encodeGid(tile)), compression })
    }
    return written
  }

  Object.assign(target, fields)
  if (layer.infinite) {
    target.chunks = (layer.chunks ?? []).map((chunk) =>
      withData({ x: chunk.x, y: chunk.y, width: chunk.width, height: chunk.height }, chunk.tiles)
    )
    return target
  }

  return withData(target, layer.tiles)
}

function encodeTiles(
  tiles: readonly (ResolvedTile | null)[],
  encoding: TiledEncoding
): number[] | string {
  const gids = tiles.map((tile) => encodeGid(tile))
  return encoding === 'base64' ? bytesToBase64(gidsToBytes(gids)) : gids
}

function gidsToBytes(gids: number[]): Uint8Array {
  const bytes = new Uint8Array(gids.length * 4)
  const view = new DataView(bytes.buffer)
  for (let i = 0; i < gids.length; i++) {
    view.setUint32(i * 4, gids[i] ?? 0, true)
  }
  return bytes
}

function bytesToBase64(bytes: Uint8Array): string {
  // Chunked, because String.fromCharCode(...) blows the argument limit on the
  // large layers this is most useful for.
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return globalThis.btoa(binary)
}

/** Tiled's `zlib` is the zlib-wrapped deflate the Compression Streams API calls `deflate`. */
async function compressBytes(
  bytes: Uint8Array,
  compression: TiledDataCompression
): Promise<Uint8Array> {
  const stream = new CompressionStream(compression === 'gzip' ? 'gzip' : 'deflate')
  const writer = stream.writable.getWriter()
  const written = writer.write(bytes as Uint8Array<ArrayBuffer>).then(() => writer.close())

  const reader = stream.readable.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    length += value.byteLength
  }
  await written

  const result = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.byteLength
  }
  return result
}

function exportObject(object: ResolvedObject): TiledObject {
  return {
    id: object.id,
    name: object.name,
    type: object.type,
    x: object.x,
    y: object.y,
    width: object.width,
    height: object.height,
    rotation: object.rotation,
    visible: object.visible,
    ...(object.tile ? { gid: encodeGid(object.tile) } : {}),
    ...optional('properties', object.properties && [...object.properties]),
    ...optional('text', object.text),
    ...optional('opacity', object.opacity),
    ...optional('capsule', object.capsule),
    ...optional('ellipse', object.ellipse),
    ...optional('point', object.point),
    ...optional('polygon', object.polygon),
    ...optional('polyline', object.polyline)
  }
}

function normalizeTilesetSources(
  sources: ExportMapOptions['tilesetSources']
): Map<string, string> | undefined {
  if (!sources) return undefined
  return sources instanceof Map ? sources : new Map(Object.entries(sources))
}

function isZeroOffset(offset: TiledTileOffset): boolean {
  return offset.x === 0 && offset.y === 0
}

function properties(list: readonly TiledProperty[]) {
  return list.length > 0 ? { properties: [...list] } : {}
}

/** Emits `key` only when the value is present, keeping the output free of holes. */
function optional<K extends string, V>(key: K, value: V | undefined) {
  return (value === undefined ? {} : { [key]: value }) as { [P in K]?: V }
}

/**
 * Emits `key` only when it differs from the value the parser would default to.
 *
 * `NoInfer` keeps a literal fallback from widening the value's union type (a
 * `'topdown'` fallback would otherwise infer `V` as `string`).
 */
function omitDefault<K extends string, V>(key: K, value: V, fallback: NoInfer<V>) {
  return (value === fallback ? {} : { [key]: value }) as { [P in K]?: V }
}
