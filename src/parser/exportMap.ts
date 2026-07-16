import { walkLayers } from '../mapLookup.js'
import type {
  ResolvedLayer,
  ResolvedMap,
  ResolvedObject,
  ResolvedTile,
  ResolvedTileLayer,
  ResolvedTileset,
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
   * How to write tile layer data. `'csv'` (the default) writes a plain GID
   * array; `'base64'` writes uncompressed base64. Both are readable by the
   * synchronous `parseMap`.
   *
   * Compressed output is deliberately unsupported: it would make `exportMap`
   * async, since the Compression Streams API has no synchronous form.
   */
  encoding?: TiledEncoding
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
 */
export function exportMap(map: ResolvedMap, options?: ExportMapOptions): TiledMap {
  const encoding = options?.encoding ?? 'csv'
  const sources = normalizeTilesetSources(options?.tilesetSources)

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
    nextlayerid: nextLayerId(map),
    nextobjectid: nextObjectId(map),
    ...optional('backgroundcolor', map.backgroundcolor),
    ...optional('hexsidelength', map.hexsidelength),
    ...optional('staggeraxis', map.staggeraxis),
    ...optional('staggerindex', map.staggerindex),
    ...omitDefault('parallaxoriginx', map.parallaxoriginx, 0),
    ...omitDefault('parallaxoriginy', map.parallaxoriginy, 0),
    ...properties(map.properties),
    tilesets: map.tilesets.map((tileset) => exportMapTileset(tileset, sources)),
    layers: map.layers.map((layer) => exportLayer(layer, encoding))
  }
}

export interface ExportTilesetOptions {
  /**
   * Write the tileset as a standalone `.tsj` file rather than as embedded map
   * data: adds `type: 'tileset'` and omits `firstgid`, which belongs to the
   * referencing map rather than to the tileset file.
   */
  standalone?: boolean
  /** Format version for a standalone file. Defaults to `'1.10'`. */
  version?: string
  /** Editor version for a standalone file. Omitted when not given. */
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
    version: options.version ?? '1.10',
    ...optional('tiledversion', options.tiledversion),
    ...exportTilesetBody(tileset)
  }
}

/** Everything both the embedded and the standalone form share. */
function exportTilesetBody(tileset: ResolvedTileset): TiledTilesetFile {
  return {
    name: tileset.name,
    tilewidth: tileset.tilewidth,
    tileheight: tileset.tileheight,
    columns: tileset.columns,
    tilecount: tileset.tilecount,
    margin: tileset.margin,
    spacing: tileset.spacing,
    ...optional('image', tileset.image),
    ...optional('imagewidth', tileset.imagewidth),
    ...optional('imageheight', tileset.imageheight),
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

function exportLayer(layer: ResolvedLayer, encoding: TiledEncoding): TiledLayer {
  const common = exportLayerCommon(layer)

  switch (layer.type) {
    case 'tilelayer':
      return {
        ...common,
        type: 'tilelayer',
        width: layer.width,
        height: layer.height,
        ...exportTileLayerData(layer, encoding)
      }
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
        ...omitDefault('draworder', layer.draworder, 'topdown'),
        objects: layer.objects.map(exportObject)
      }
    case 'group':
      return {
        ...common,
        type: 'group',
        layers: layer.layers.map((child) => exportLayer(child, encoding))
      }
  }
}

function exportLayerCommon(layer: ResolvedLayer) {
  return {
    id: layer.id,
    name: layer.name,
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
    ...properties(layer.properties)
  }
}

function exportTileLayerData(
  layer: ResolvedTileLayer,
  encoding: TiledEncoding
): Pick<TiledLayer, 'data' | 'chunks' | 'encoding'> {
  // A GID array needs no `encoding` field; that is how Tiled writes CSV to JSON.
  const encodingField = encoding === 'base64' ? { encoding } : {}

  if (layer.infinite) {
    return {
      ...encodingField,
      chunks: (layer.chunks ?? []).map((chunk) => ({
        x: chunk.x,
        y: chunk.y,
        width: chunk.width,
        height: chunk.height,
        data: encodeTiles(chunk.tiles, encoding)
      }))
    }
  }

  return { ...encodingField, data: encodeTiles(layer.tiles, encoding) }
}

function encodeTiles(
  tiles: readonly (ResolvedTile | null)[],
  encoding: TiledEncoding
): number[] | string {
  const gids = tiles.map((tile) => encodeGid(tile))
  return encoding === 'base64' ? gidsToBase64(gids) : gids
}

function gidsToBase64(gids: number[]): string {
  const bytes = new Uint8Array(gids.length * 4)
  const view = new DataView(bytes.buffer)
  for (let i = 0; i < gids.length; i++) {
    view.setUint32(i * 4, gids[i] ?? 0, true)
  }

  // Chunked, because String.fromCharCode(...) blows the argument limit on the
  // large layers this is most useful for.
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return globalThis.btoa(binary)
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
    ...optional('ellipse', object.ellipse),
    ...optional('point', object.point),
    ...optional('polygon', object.polygon),
    ...optional('polyline', object.polyline)
  }
}

function nextLayerId(map: ResolvedMap): number {
  let max = 0
  for (const layer of walkLayers(map)) {
    if (layer.id > max) max = layer.id
  }
  return max + 1
}

function nextObjectId(map: ResolvedMap): number {
  let max = 0
  for (const layer of walkLayers(map)) {
    if (layer.type !== 'objectgroup') continue
    for (const object of layer.objects) {
      if (object.id > max) max = object.id
    }
  }
  return max + 1
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
