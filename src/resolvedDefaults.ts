import type {
  ResolvedMap,
  ResolvedObject,
  ResolvedTileset,
  TiledFillMode,
  TiledObjectAlignment,
  TiledProperty,
  TiledRenderOrder,
  TiledTileOffset,
  TiledTileRenderSize
} from './types/index.js'

export interface ResolvedMapDefaultInput {
  orientation?: ResolvedMap['orientation']
  renderorder?: TiledRenderOrder
  width?: number
  height?: number
  tilewidth?: number
  tileheight?: number
  infinite?: boolean
  parallaxoriginx?: number
  parallaxoriginy?: number
  properties?: TiledProperty[]
  version?: string
}

export function resolvedMapDefaults(
  input: ResolvedMapDefaultInput,
  versionFallback = '1.0'
): Pick<
  ResolvedMap,
  | 'orientation'
  | 'renderorder'
  | 'width'
  | 'height'
  | 'tilewidth'
  | 'tileheight'
  | 'infinite'
  | 'parallaxoriginx'
  | 'parallaxoriginy'
  | 'properties'
  | 'version'
> {
  return {
    orientation: input.orientation ?? 'orthogonal',
    renderorder: input.renderorder ?? 'right-down',
    width: input.width ?? 0,
    height: input.height ?? 0,
    tilewidth: input.tilewidth ?? 0,
    tileheight: input.tileheight ?? 0,
    infinite: input.infinite ?? false,
    parallaxoriginx: input.parallaxoriginx ?? 0,
    parallaxoriginy: input.parallaxoriginy ?? 0,
    properties: input.properties ?? [],
    version: input.version ?? versionFallback
  }
}

export interface ResolvedLayerDefaultInput {
  id?: number
  name?: string
  opacity?: number
  visible?: boolean
  offsetx?: number
  offsety?: number
  parallaxx?: number
  parallaxy?: number
  tintcolor?: string
  properties?: TiledProperty[]
}

export function resolvedLayerDefaults(input: ResolvedLayerDefaultInput, idFallback = 0) {
  return {
    id: input.id ?? idFallback,
    name: input.name ?? '',
    opacity: input.opacity ?? 1,
    visible: input.visible ?? true,
    offsetx: input.offsetx ?? 0,
    offsety: input.offsety ?? 0,
    parallaxx: input.parallaxx ?? 1,
    parallaxy: input.parallaxy ?? 1,
    tintcolor: input.tintcolor,
    properties: input.properties ?? []
  }
}

export interface ResolvedObjectDefaultInput {
  id?: number
  name?: string
  type?: string
  x?: number
  y?: number
  width?: number
  height?: number
  rotation?: number
  visible?: boolean
  properties?: TiledProperty[]
  text?: ResolvedObject['text']
  ellipse?: boolean
  point?: boolean
  polygon?: ResolvedObject['polygon']
  polyline?: ResolvedObject['polyline']
}

export function resolvedObjectDefaults(input: ResolvedObjectDefaultInput): ResolvedObject {
  return {
    id: input.id ?? 0,
    name: input.name ?? '',
    type: input.type ?? '',
    x: input.x ?? 0,
    y: input.y ?? 0,
    width: input.width ?? 0,
    height: input.height ?? 0,
    rotation: input.rotation ?? 0,
    visible: input.visible ?? true,
    properties: input.properties,
    text: input.text,
    ellipse: input.ellipse,
    point: input.point,
    polygon: input.polygon,
    polyline: input.polyline
  }
}

export interface ResolvedTilesetDefaultInput {
  firstgid?: number
  name?: string
  tilewidth?: number
  tileheight?: number
  columns?: number
  tilecount?: number
  margin?: number
  spacing?: number
  imagewidth?: number
  tileoffset?: TiledTileOffset
  objectalignment?: TiledObjectAlignment
  tilerendersize?: TiledTileRenderSize
  fillmode?: TiledFillMode
  properties?: TiledProperty[]
  tileDefinitionCount?: number
}

export function resolvedTilesetDefaults(
  input: ResolvedTilesetDefaultInput
): Pick<
  ResolvedTileset,
  | 'firstgid'
  | 'name'
  | 'tilewidth'
  | 'tileheight'
  | 'columns'
  | 'tilecount'
  | 'margin'
  | 'spacing'
  | 'tileoffset'
  | 'objectalignment'
  | 'tilerendersize'
  | 'fillmode'
  | 'properties'
> {
  const tilewidth = input.tilewidth ?? 0
  const tileheight = input.tileheight ?? 0
  const margin = input.margin ?? 0
  const spacing = input.spacing ?? 0

  return {
    firstgid: input.firstgid ?? 1,
    name: input.name ?? '',
    tilewidth,
    tileheight,
    columns: computeResolvedTilesetColumns({
      columns: input.columns,
      imagewidth: input.imagewidth,
      tilewidth,
      margin,
      spacing
    }),
    tilecount: input.tilecount ?? input.tileDefinitionCount ?? 0,
    margin,
    spacing,
    tileoffset: input.tileoffset ?? { x: 0, y: 0 },
    objectalignment: input.objectalignment ?? 'unspecified',
    tilerendersize: input.tilerendersize ?? 'tile',
    fillmode: input.fillmode ?? 'stretch',
    properties: input.properties ?? []
  }
}

export interface TilesetColumnsInput {
  columns?: number
  imagewidth?: number
  tilewidth: number
  margin: number
  spacing: number
}

export function computeResolvedTilesetColumns(input: TilesetColumnsInput): number {
  if (input.columns && input.columns > 0) return input.columns
  if (!input.imagewidth || input.tilewidth <= 0) return 0
  return Math.floor(
    (input.imagewidth - 2 * input.margin + input.spacing) / (input.tilewidth + input.spacing)
  )
}
