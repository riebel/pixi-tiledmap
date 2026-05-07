/**
 * @vitest-environment jsdom
 */
import { Mesh, Texture } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { TileLayerRenderer } from '../../src/renderer/TileLayerRenderer.js'
import { TileSetRenderer } from '../../src/renderer/TileSetRenderer.js'
import type {
  MapContext,
  ResolvedTile,
  ResolvedTileLayer,
  ResolvedTileset
} from '../../src/types/index.js'

const SIZE = 32

const ctx: MapContext = {
  orientation: 'orthogonal',
  renderorder: 'right-down',
  tilewidth: SIZE,
  tileheight: SIZE,
  tileSpritePadding: 0
}

function makeTileset(): TileSetRenderer {
  const ts: ResolvedTileset = {
    firstgid: 1,
    name: 'test',
    tilewidth: SIZE,
    tileheight: SIZE,
    columns: 1,
    tilecount: 1,
    margin: 0,
    spacing: 0,
    tileoffset: { x: 0, y: 0 },
    objectalignment: 'unspecified',
    tilerendersize: 'tile',
    fillmode: 'stretch',
    tiles: new Map(),
    properties: []
  }
  const renderer = new TileSetRenderer(ts, null)
  renderer.setTileTexture(0, Texture.EMPTY)
  return renderer
}

function makeTile(flags: Partial<ResolvedTile>): ResolvedTile {
  return {
    gid: 1,
    localId: 0,
    tilesetIndex: 0,
    horizontalFlip: false,
    verticalFlip: false,
    diagonalFlip: false,
    ...flags
  }
}

function makeLayer(tile: ResolvedTile): TileLayerRenderer {
  const layer: ResolvedTileLayer = {
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
    tiles: [tile]
  }
  return new TileLayerRenderer(layer, [makeTileset()], ctx)
}

function meshUvs(tile: ResolvedTile): number[] {
  const mesh = makeLayer(tile).children[0] as Mesh
  expect(mesh).toBeInstanceOf(Mesh)
  return Array.from(mesh.geometry.uvs)
}

describe('packed tile UV transforms -non-diagonal', () => {
  it('no flip: keeps source UV order', () => {
    expect(meshUvs(makeTile({}))).toEqual([0, 0, 1, 0, 1, 1, 0, 1])
  })

  it('H flip: mirrors UVs horizontally', () => {
    expect(meshUvs(makeTile({ horizontalFlip: true }))).toEqual([1, 0, 0, 0, 0, 1, 1, 1])
  })

  it('V flip: mirrors UVs vertically', () => {
    expect(meshUvs(makeTile({ verticalFlip: true }))).toEqual([0, 1, 1, 1, 1, 0, 0, 0])
  })

  it('H+V flip: rotates UVs by 180 degrees', () => {
    expect(meshUvs(makeTile({ horizontalFlip: true, verticalFlip: true }))).toEqual([
      1, 1, 0, 1, 0, 0, 1, 0
    ])
  })
})

describe('packed tile UV transforms -diagonal', () => {
  it('D+H: rotates UVs clockwise', () => {
    expect(meshUvs(makeTile({ diagonalFlip: true, horizontalFlip: true }))).toEqual([
      0, 1, 0, 0, 1, 0, 1, 1
    ])
  })

  it('D+V: rotates UVs counter-clockwise', () => {
    expect(meshUvs(makeTile({ diagonalFlip: true, verticalFlip: true }))).toEqual([
      1, 0, 1, 1, 0, 1, 0, 0
    ])
  })

  it('D alone: transposes UVs', () => {
    expect(meshUvs(makeTile({ diagonalFlip: true }))).toEqual([0, 0, 0, 1, 1, 1, 1, 0])
  })

  it('D+H+V: transposes and flips both axes', () => {
    expect(
      meshUvs(makeTile({ diagonalFlip: true, horizontalFlip: true, verticalFlip: true }))
    ).toEqual([1, 1, 1, 0, 0, 0, 0, 1])
  })
})
