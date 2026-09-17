// ─── Tiled JSON Map Format Types ─────────────────────────────────────────────
// Based on Tiled 1.11 JSON Map Format specification
// https://doc.mapeditor.org/en/stable/reference/json-map-format/

import type { Texture } from 'pixi.js'
import type { GifSource } from 'pixi.js/gif'

// ─── Enums / String Unions ───────────────────────────────────────────────────

export type TiledOrientation = 'orthogonal' | 'isometric' | 'staggered' | 'hexagonal' | 'oblique'

export type TiledRenderOrder = 'right-down' | 'right-up' | 'left-down' | 'left-up'

export type TiledStaggerAxis = 'x' | 'y'

export type TiledStaggerIndex = 'odd' | 'even'

/** Tiled 1.12 layer blend modes. */
export type TiledBlendMode =
  | 'normal'
  | 'add'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'

export type TiledLayerType = 'tilelayer' | 'objectgroup' | 'imagelayer' | 'group'

export type TiledDrawOrder = 'topdown' | 'index'

export type TiledEncoding = 'csv' | 'base64'

export type TiledCompression = 'zlib' | 'gzip' | 'zstd' | ''

export type TiledPropertyType =
  | 'string'
  | 'int'
  | 'float'
  | 'bool'
  | 'color'
  | 'file'
  | 'object'
  | 'class'
  | 'list'

export type TiledObjectAlignment =
  | 'unspecified'
  | 'topleft'
  | 'top'
  | 'topright'
  | 'left'
  | 'center'
  | 'right'
  | 'bottomleft'
  | 'bottom'
  | 'bottomright'

export type TiledTileRenderSize = 'tile' | 'grid'

export type TiledFillMode = 'stretch' | 'preserve-aspect-fit'

export type TiledGridOrientation = 'orthogonal' | 'isometric'

export type TiledWangSetType = 'corner' | 'edge' | 'mixed'

export type TiledHAlign = 'center' | 'right' | 'justify' | 'left'

export type TiledVAlign = 'center' | 'bottom' | 'top'

// ─── Property ────────────────────────────────────────────────────────────────

/**
 * A custom property value. Scalars cover most types; an `object` property holds
 * the referenced object's id. A `class` property holds its members by name, and
 * a `list` property (Tiled 1.12) holds typed items.
 */
export type TiledPropertyValue = string | number | boolean | TiledClassValue | TiledListItem[]

/** The members of a `class` property, as Tiled writes them to JSON. */
export interface TiledClassValue {
  [member: string]: TiledPropertyValue
}

/** One item of a `list` property. */
export interface TiledListItem {
  type: TiledPropertyType
  propertytype?: string
  value: TiledPropertyValue
}

export interface TiledProperty {
  name: string
  type: TiledPropertyType
  propertytype?: string
  value: TiledPropertyValue
}

// ─── Point ───────────────────────────────────────────────────────────────────

export interface TiledPoint {
  x: number
  y: number
}

// ─── Text ────────────────────────────────────────────────────────────────────

export interface TiledText {
  bold?: boolean
  color?: string
  fontfamily?: string
  halign?: TiledHAlign
  italic?: boolean
  kerning?: boolean
  pixelsize?: number
  strikeout?: boolean
  text: string
  underline?: boolean
  valign?: TiledVAlign
  wrap?: boolean
}

// ─── Object ──────────────────────────────────────────────────────────────────

/**
 * A map object. A template instance (`template` set) carries only the fields
 * it overrides, as Tiled writes it, so any other field may be absent there.
 */
export interface TiledObject {
  /** Tiled 1.12: a capsule (stadium) shape spanning the object's size. */
  capsule?: boolean
  /** Tiled 1.9 JSON wrote an object's class here instead of in `type`. */
  class?: string
  ellipse?: boolean
  gid?: number
  height: number
  id: number
  name: string
  /** Tiled 1.12: object opacity from 0 to 1. Absent means 1. */
  opacity?: number
  point?: boolean
  polygon?: TiledPoint[]
  polyline?: TiledPoint[]
  properties?: TiledProperty[]
  rotation: number
  template?: string
  text?: TiledText
  type: string
  visible: boolean
  width: number
  x: number
  y: number
}

// ─── Chunk (infinite maps) ───────────────────────────────────────────────────

export interface TiledChunk {
  data: number[] | string
  height: number
  width: number
  x: number
  y: number
}

// ─── Layer ───────────────────────────────────────────────────────────────────

export interface TiledLayer {
  chunks?: TiledChunk[]
  class?: string
  /** Object layers only: the color the Tiled editor draws the layer's objects in. */
  color?: string
  compression?: TiledCompression
  data?: number[] | string
  draworder?: TiledDrawOrder
  encoding?: TiledEncoding
  height?: number
  id: number
  image?: string
  imageheight?: number
  imagewidth?: number
  layers?: TiledLayer[]
  locked?: boolean
  /** Tiled 1.12: blend mode. Absent means `'normal'`. */
  mode?: TiledBlendMode
  name: string
  objects?: TiledObject[]
  offsetx?: number
  offsety?: number
  opacity: number
  parallaxx?: number
  parallaxy?: number
  properties?: TiledProperty[]
  repeatx?: boolean
  repeaty?: boolean
  startx?: number
  starty?: number
  tintcolor?: string
  transparentcolor?: string
  type: TiledLayerType
  visible: boolean
  width?: number
  x: number
  y: number
}

// ─── Frame (tile animation) ──────────────────────────────────────────────────

export interface TiledFrame {
  duration: number
  tileid: number
}

// ─── Tile Offset ─────────────────────────────────────────────────────────────

export interface TiledTileOffset {
  x: number
  y: number
}

// ─── Grid ────────────────────────────────────────────────────────────────────

export interface TiledGrid {
  height: number
  orientation: TiledGridOrientation
  width: number
}

// ─── Transformations ─────────────────────────────────────────────────────────

export interface TiledTransformations {
  hflip: boolean
  vflip: boolean
  rotate: boolean
  preferuntransformed: boolean
}

// ─── Terrain ─────────────────────────────────────────────────────────────────

export interface TiledTerrain {
  name: string
  properties?: TiledProperty[]
  tile: number
}

// ─── Wang Color ──────────────────────────────────────────────────────────────

export interface TiledWangColor {
  class?: string
  color: string
  name: string
  probability: number
  properties?: TiledProperty[]
  tile: number
}

// ─── Wang Tile ───────────────────────────────────────────────────────────────

export interface TiledWangTile {
  tileid: number
  wangid: number[]
}

// ─── Wang Set ────────────────────────────────────────────────────────────────

export interface TiledWangSet {
  class?: string
  colors: TiledWangColor[]
  name: string
  properties?: TiledProperty[]
  tile: number
  type: TiledWangSetType
  wangtiles: TiledWangTile[]
}

// ─── Tile Definition ─────────────────────────────────────────────────────────

export interface TiledTileDefinition {
  animation?: TiledFrame[]
  /** Tiled 1.9 JSON wrote a tile's class here; the parser moves it to `type`. */
  class?: string
  id: number
  image?: string
  imageheight?: number
  imagewidth?: number
  x?: number
  y?: number
  width?: number
  height?: number
  objectgroup?: TiledLayer
  probability?: number
  properties?: TiledProperty[]
  terrain?: number[]
  type?: string
}

// ─── Tileset ─────────────────────────────────────────────────────────────────

export interface TiledTileset {
  backgroundcolor?: string
  class?: string
  columns: number
  fillmode?: TiledFillMode
  firstgid: number
  grid?: TiledGrid
  image?: string
  imageheight?: number
  imagewidth?: number
  margin: number
  name: string
  objectalignment?: TiledObjectAlignment
  properties?: TiledProperty[]
  source?: string
  spacing: number
  terrains?: TiledTerrain[]
  tilecount: number
  tiledversion?: string
  tileheight: number
  tileoffset?: TiledTileOffset
  tilerendersize?: TiledTileRenderSize
  tiles?: TiledTileDefinition[]
  tilewidth: number
  transformations?: TiledTransformations
  transparentcolor?: string
  type?: string
  version?: string
  wangsets?: TiledWangSet[]
}

// ─── External tileset reference (before resolution) ──────────────────────────

export interface TiledTilesetRef {
  firstgid: number
  source: string
}

// ─── Standalone tileset file ─────────────────────────────────────────────────

/**
 * A tileset as it exists in a standalone `.tsj` / `.tsx` file.
 *
 * Such a file carries no `firstgid`: the first global id belongs to the map
 * that references the tileset, not to the tileset itself, and the parser reads
 * it from that reference. A standalone file instead carries `type: 'tileset'`.
 *
 * An embedded `TiledTileset` is still assignable here, so this type only widens
 * what an API accepts.
 */
export type TiledTilesetFile = Omit<TiledTileset, 'firstgid'>

// ─── Map ─────────────────────────────────────────────────────────────────────

export interface TiledMap {
  backgroundcolor?: string
  class?: string
  compressionlevel?: number
  height: number
  hexsidelength?: number
  infinite: boolean
  layers: TiledLayer[]
  nextlayerid: number
  nextobjectid: number
  orientation: TiledOrientation
  parallaxoriginx?: number
  parallaxoriginy?: number
  properties?: TiledProperty[]
  renderorder?: TiledRenderOrder
  /** Oblique maps only (Tiled 1.12): horizontal shift per tile row, in pixels. */
  skewx?: number
  /** Oblique maps only (Tiled 1.12): vertical shift per tile column, in pixels. */
  skewy?: number
  staggeraxis?: TiledStaggerAxis
  staggerindex?: TiledStaggerIndex
  tiledversion?: string
  tileheight: number
  tilesets: (TiledTileset | TiledTilesetRef)[]
  tilewidth: number
  type: 'map'
  version: string
  width: number
}

// ─── Object Template ─────────────────────────────────────────────────────────

export interface TiledObjectTemplate {
  type: 'template'
  tileset?: TiledTileset | TiledTilesetRef
  object: TiledObject
}

// ─── GID Bit Flags ───────────────────────────────────────────────────────────

export const FLIPPED_HORIZONTALLY_FLAG = 0x80000000
export const FLIPPED_VERTICALLY_FLAG = 0x40000000
export const FLIPPED_DIAGONALLY_FLAG = 0x20000000
export const ROTATED_HEXAGONAL_120_FLAG = 0x10000000
export const GID_MASK = 0x0fffffff

// ─── Resolved types (post-parse, used by renderer) ──────────────────────────

export interface ResolvedTile {
  gid: number
  localId: number
  tilesetIndex: number
  horizontalFlip: boolean
  verticalFlip: boolean
  diagonalFlip: boolean
  /**
   * Tiled's 120° hexagonal rotation bit, preserved so a decoded tile can be
   * encoded back to its exact GID. Set only when the bit is present.
   *
   * On hexagonal maps the renderer turns such a tile by 120 degrees, and a
   * `diagonalFlip` tile by 60 degrees, as Tiled does. Other orientations
   * ignore this bit.
   */
  rotatedHex120?: boolean
  /**
   * Runtime-only render opacity. Not part of the Tiled format, so `exportMap`
   * cannot represent it; a GID carries no alpha.
   */
  alpha?: number
}

export interface ResolvedObject {
  id: number
  name: string
  type: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  visible: boolean
  properties?: TiledProperty[]
  tile?: ResolvedTile
  text?: TiledText
  /** Tiled 1.12 object opacity; absent means 1. */
  opacity?: number
  /** Tiled 1.12 capsule shape. */
  capsule?: boolean
  ellipse?: boolean
  point?: boolean
  polygon?: TiledPoint[]
  polyline?: TiledPoint[]
}

export interface ResolvedChunk {
  x: number
  y: number
  width: number
  height: number
  tiles: (ResolvedTile | null)[]
}

export interface ResolvedTileLayer {
  type: 'tilelayer'
  id: number
  name: string
  class?: string
  /** Editor-only: the layer is locked against editing. */
  locked?: boolean
  opacity: number
  visible: boolean
  offsetx: number
  offsety: number
  parallaxx: number
  parallaxy: number
  tintcolor?: string
  /** Tiled 1.12 blend mode; absent means `'normal'`. */
  mode?: TiledBlendMode
  properties: TiledProperty[]
  width: number
  height: number
  infinite: boolean
  tiles: (ResolvedTile | null)[]
  chunks?: ResolvedChunk[]
}

export interface ResolvedImageLayer {
  type: 'imagelayer'
  id: number
  name: string
  class?: string
  /** Editor-only: the layer is locked against editing. */
  locked?: boolean
  opacity: number
  visible: boolean
  offsetx: number
  offsety: number
  parallaxx: number
  parallaxy: number
  tintcolor?: string
  /** Tiled 1.12 blend mode; absent means `'normal'`. */
  mode?: TiledBlendMode
  properties: TiledProperty[]
  image: string
  imagewidth?: number
  imageheight?: number
  repeatx: boolean
  repeaty: boolean
  transparentcolor?: string
}

export interface ResolvedObjectLayer {
  type: 'objectgroup'
  id: number
  name: string
  class?: string
  /** Editor-only: the layer is locked against editing. */
  locked?: boolean
  opacity: number
  visible: boolean
  offsetx: number
  offsety: number
  parallaxx: number
  parallaxy: number
  tintcolor?: string
  /** Tiled 1.12 blend mode; absent means `'normal'`. */
  mode?: TiledBlendMode
  properties: TiledProperty[]
  /** Editor color of the layer's objects; `undefined` means Tiled's default gray. */
  color?: string
  draworder: TiledDrawOrder
  objects: ResolvedObject[]
}

export interface ResolvedGroupLayer {
  type: 'group'
  id: number
  name: string
  class?: string
  /** Editor-only: the layer is locked against editing. */
  locked?: boolean
  opacity: number
  visible: boolean
  offsetx: number
  offsety: number
  parallaxx: number
  parallaxy: number
  tintcolor?: string
  /** Tiled 1.12 blend mode; absent means `'normal'`. */
  mode?: TiledBlendMode
  properties: TiledProperty[]
  layers: ResolvedLayer[]
}

export type ResolvedLayer =
  | ResolvedTileLayer
  | ResolvedImageLayer
  | ResolvedObjectLayer
  | ResolvedGroupLayer

export interface ResolvedTileset {
  firstgid: number
  name: string
  class?: string
  source?: string
  tilewidth: number
  tileheight: number
  columns: number
  tilecount: number
  margin: number
  spacing: number
  image?: string
  imagewidth?: number
  imageheight?: number
  tileoffset: TiledTileOffset
  objectalignment: TiledObjectAlignment
  tilerendersize: TiledTileRenderSize
  fillmode: TiledFillMode
  tiles: Map<number, TiledTileDefinition>
  properties: TiledProperty[]
  transformations?: TiledTransformations
  grid?: TiledGrid
  wangsets?: TiledWangSet[]
  terrains?: TiledTerrain[]
  backgroundcolor?: string
  /** The color keyed out of the tileset image, as `#RRGGBB`. */
  transparentcolor?: string
  /** Format version of a standalone tileset file. */
  version?: string
  /** Editor version of a standalone tileset file. */
  tiledversion?: string
}

export interface ResolvedMap {
  class?: string
  orientation: TiledOrientation
  renderorder: TiledRenderOrder
  width: number
  height: number
  tilewidth: number
  tileheight: number
  infinite: boolean
  backgroundcolor?: string
  hexsidelength?: number
  staggeraxis?: TiledStaggerAxis
  staggerindex?: TiledStaggerIndex
  skewx?: number
  skewy?: number
  parallaxoriginx: number
  parallaxoriginy: number
  properties: TiledProperty[]
  tilesets: ResolvedTileset[]
  layers: ResolvedLayer[]
  version: string
  tiledversion?: string
  compressionlevel?: number
  /**
   * The id Tiled gives the next new layer. `exportMap` never writes less than
   * the highest layer id plus one, so ids of deleted layers stay retired.
   */
  nextlayerid?: number
  /** The id Tiled gives the next new object; see `nextlayerid`. */
  nextobjectid?: number
}

// ─── Parser options ──────────────────────────────────────────────────────────

export interface ParseOptions {
  /**
   * External tilesets by their `source` path. Keyed exactly as the map
   * references them.
   *
   * A tileset's own `firstgid` is never read: the map's reference supplies it.
   */
  externalTilesets?: Map<string, TiledTilesetFile>
  templates?: Map<string, TiledObjectTemplate>
}

// ─── Renderer options ────────────────────────────────────────────────────────

export interface TiledMapOptions {
  tilesetTextures?: Map<string, Texture>
  imageLayerTextures?: Map<string, Texture>
  tileImageTextures?: Map<string, Texture>
  tileImageGifSources?: Map<string, GifSource>
  imageLayerGifSources?: Map<string, GifSource>
  /**
   * Render only layers accepted by this predicate. Group layers are kept when
   * they match directly or contain a matching descendant.
   */
  layerFilter?: TiledLayerFilter
  /**
   * Extra pixels added to full-size orthogonal tile sprites to hide subpixel
   * seams when the map container is scaled by a fractional amount.
   *
   * Set to 0 to disable.
   */
  tileSpritePadding?: number
  /**
   * Maximum number of quads to place in one packed tile mesh.
   *
   * The default keeps one mesh below 16-bit index limits while reducing draw
   * object count for large layers.
   */
  tileMeshBatchSize?: number
  /**
   * How object layers draw shape objects (rectangles, ellipses, points,
   * polygons, polylines). Defaults match the Tiled editor.
   */
  objectStyle?: TiledObjectStyle
}

export interface TiledObjectStyle {
  /**
   * Opacity of the fill of closed shapes, from 0 to 1. Defaults to the Tiled
   * editor's 50/255. Set to 0 to draw outlines only.
   */
  fillAlpha?: number
  /**
   * Draw each named shape object's name centered above it, as the Tiled
   * editor does. Defaults to `true`.
   */
  showLabels?: boolean
  /** Object color for layers without their own `color`. Defaults to `#a0a0a4`. */
  defaultColor?: string
  /**
   * Keep outlines one device pixel wide and labels at their on-screen size
   * however the map is scaled, as the Tiled editor does. Set to `false` to
   * scale them with the map instead. Defaults to `true`.
   *
   * This uses the object layer's `onRender` hook; replacing that hook stops
   * the adjustment.
   */
  screenSpace?: boolean
  /**
   * Clip text objects to their box, as the Tiled editor does. Each clipped
   * text object gets a mask. Defaults to `true`.
   */
  clipText?: boolean
}

export type TiledLayerFilter = (layer: ResolvedLayer) => boolean

// ─── Runtime tile editing ───────────────────────────────────────────────────

export type TiledTileLayerSelector = string | number

export interface TiledTileRef {
  gid?: number
  tileset?: string | number
  tileId?: number
  localId?: number
  horizontalFlip?: boolean
  verticalFlip?: boolean
  diagonalFlip?: boolean
  rotatedHex120?: boolean
  alpha?: number
}

export type TiledTileInput = number | ResolvedTile | TiledTileRef | null

// ─── Tile placement ──────────────────────────────────────────────────────────

export interface MapContext {
  orientation: TiledOrientation
  renderorder: TiledRenderOrder
  tilewidth: number
  tileheight: number
  hexsidelength?: number
  staggeraxis?: TiledStaggerAxis
  staggerindex?: TiledStaggerIndex
  skewx?: number
  skewy?: number
  /** Map height in tiles; places Tiled's screen origin on isometric maps. */
  mapHeight?: number
  /** Map width in pixels; used by image layers when tiling (repeatx/repeaty). */
  mapPixelWidth?: number
  /** Map height in pixels; used by image layers when tiling (repeatx/repeaty). */
  mapPixelHeight?: number
  tileSpritePadding?: number
  tileMeshBatchSize?: number
}

export interface TilePosition {
  x: number
  y: number
}

/** A tile grid cell, as returned by `tileAt`. */
export interface TileCell {
  column: number
  row: number
}
