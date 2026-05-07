import { Texture } from 'pixi.js'
import { TileSetRenderer } from '../../src/renderer/TileSetRenderer.js'
import type {
  ResolvedChunk,
  ResolvedGroupLayer,
  ResolvedImageLayer,
  ResolvedMap,
  ResolvedObjectLayer,
  ResolvedTile,
  ResolvedTileLayer,
  ResolvedTileset,
  TiledTileDefinition
} from '../../src/types/index.js'

export function makeResolvedMap(overrides?: Partial<ResolvedMap>): ResolvedMap {
  return {
    orientation: 'orthogonal',
    renderorder: 'right-down',
    width: 2,
    height: 2,
    tilewidth: 32,
    tileheight: 32,
    infinite: false,
    parallaxoriginx: 0,
    parallaxoriginy: 0,
    properties: [],
    tilesets: [],
    layers: [],
    version: '1.10',
    ...overrides
  }
}

export function makeResolvedTileLayer(overrides?: Partial<ResolvedTileLayer>): ResolvedTileLayer {
  return {
    type: 'tilelayer',
    id: 1,
    name: 'layer',
    opacity: 1,
    visible: true,
    offsetx: 0,
    offsety: 0,
    parallaxx: 1,
    parallaxy: 1,
    properties: [],
    width: 1,
    height: 1,
    infinite: false,
    tiles: [],
    ...overrides
  }
}

export function makeResolvedImageLayer(
  overrides?: Partial<ResolvedImageLayer>
): ResolvedImageLayer {
  return {
    type: 'imagelayer',
    id: 1,
    name: 'image',
    opacity: 1,
    visible: true,
    offsetx: 0,
    offsety: 0,
    parallaxx: 1,
    parallaxy: 1,
    properties: [],
    image: '',
    repeatx: false,
    repeaty: false,
    ...overrides
  }
}

export function makeResolvedObjectLayer(
  overrides?: Partial<ResolvedObjectLayer>
): ResolvedObjectLayer {
  return {
    type: 'objectgroup',
    id: 1,
    name: 'objects',
    opacity: 1,
    visible: true,
    offsetx: 0,
    offsety: 0,
    parallaxx: 1,
    parallaxy: 1,
    properties: [],
    draworder: 'topdown',
    objects: [],
    ...overrides
  }
}

export function makeResolvedGroupLayer(
  overrides?: Partial<ResolvedGroupLayer>
): ResolvedGroupLayer {
  return {
    type: 'group',
    id: 1,
    name: 'group',
    opacity: 1,
    visible: true,
    offsetx: 0,
    offsety: 0,
    parallaxx: 1,
    parallaxy: 1,
    properties: [],
    layers: [],
    ...overrides
  }
}

export function makeResolvedTileset(overrides?: Partial<ResolvedTileset>): ResolvedTileset {
  return {
    firstgid: 1,
    name: 'test',
    tilewidth: 32,
    tileheight: 32,
    columns: 1,
    tilecount: 1,
    margin: 0,
    spacing: 0,
    tileoffset: { x: 0, y: 0 },
    objectalignment: 'unspecified',
    tilerendersize: 'tile',
    fillmode: 'stretch',
    tiles: new Map<number, TiledTileDefinition>(),
    properties: [],
    ...overrides
  }
}

export function makeResolvedTile(overrides?: Partial<ResolvedTile>): ResolvedTile {
  return {
    gid: 1,
    localId: 0,
    tilesetIndex: 0,
    horizontalFlip: false,
    verticalFlip: false,
    diagonalFlip: false,
    ...overrides
  }
}

export function makeResolvedChunk(overrides?: Partial<ResolvedChunk>): ResolvedChunk {
  return {
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    tiles: [],
    ...overrides
  }
}

export function makeTileSetRenderer(overrides?: Partial<ResolvedTileset>): TileSetRenderer {
  const renderer = new TileSetRenderer(makeResolvedTileset(overrides), null)
  renderer.setTileTexture(0, Texture.EMPTY)
  return renderer
}
