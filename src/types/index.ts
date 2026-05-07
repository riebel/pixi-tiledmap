// ─── Tiled JSON Map Format Types ─────────────────────────────────────────────
// Based on Tiled 1.11 JSON Map Format specification
// https://doc.mapeditor.org/en/stable/reference/json-map-format/

import type { Container, Texture } from 'pixi.js'
import type { GifSource } from 'pixi.js/gif'

// ─── Enums / String Unions ───────────────────────────────────────────────────

export type TiledOrientation = 'orthogonal' | 'isometric' | 'staggered' | 'hexagonal'

export type TiledRenderOrder = 'right-down' | 'right-up' | 'left-down' | 'left-up'

export type TiledStaggerAxis = 'x' | 'y'

export type TiledStaggerIndex = 'odd' | 'even'

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

export interface TiledProperty {
  name: string
  type: TiledPropertyType
  propertytype?: string
  value: string | number | boolean
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

export interface TiledObject {
  ellipse?: boolean
  gid?: number
  height: number
  id: number
  name: string
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
  opacity: number
  visible: boolean
  offsetx: number
  offsety: number
  parallaxx: number
  parallaxy: number
  tintcolor?: string
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
  opacity: number
  visible: boolean
  offsetx: number
  offsety: number
  parallaxx: number
  parallaxy: number
  tintcolor?: string
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
  opacity: number
  visible: boolean
  offsetx: number
  offsety: number
  parallaxx: number
  parallaxy: number
  tintcolor?: string
  properties: TiledProperty[]
  draworder: TiledDrawOrder
  objects: ResolvedObject[]
}

export interface ResolvedGroupLayer {
  type: 'group'
  id: number
  name: string
  opacity: number
  visible: boolean
  offsetx: number
  offsety: number
  parallaxx: number
  parallaxy: number
  tintcolor?: string
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
}

export interface ResolvedMap {
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
  parallaxoriginx: number
  parallaxoriginy: number
  properties: TiledProperty[]
  tilesets: ResolvedTileset[]
  layers: ResolvedLayer[]
  version: string
  tiledversion?: string
}

// ─── Parser options ──────────────────────────────────────────────────────────

export interface ParseOptions {
  externalTilesets?: Map<string, TiledTileset>
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
}

export type TiledLayerFilter = (layer: ResolvedLayer) => boolean

export interface TiledMapAsset {
  mapData: ResolvedMap
  container: Container
}

// ─── Tile placement ──────────────────────────────────────────────────────────

export interface MapContext {
  orientation: TiledOrientation
  renderorder: TiledRenderOrder
  tilewidth: number
  tileheight: number
  hexsidelength?: number
  staggeraxis?: TiledStaggerAxis
  staggerindex?: TiledStaggerIndex
  /** Map width in pixels; used by image layers when tiling (repeatx/repeaty). */
  mapPixelWidth?: number
  /** Map height in pixels; used by image layers when tiling (repeatx/repeaty). */
  mapPixelHeight?: number
  tileSpritePadding?: number
}

export interface TilePosition {
  x: number
  y: number
}
