/**
 * @vitest-environment jsdom
 */
import { type Sprite, Texture } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { TileLayerRenderer } from '../../src/renderer/TileLayerRenderer.js'
import { TileSetRenderer } from '../../src/renderer/TileSetRenderer.js'
import type { MapContext, ResolvedTile, ResolvedTileLayer, ResolvedTileset } from '../../src/types/index.js'

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

describe('applyFlip — non-diagonal', () => {
  // Note: applyFlip only sets the scale for the flipped axis; the other axis
  // retains whatever sprite.width/height set it to. Tests only check the
  // properties that applyFlip explicitly writes.

  it('no flip: default anchor and rotation', () => {
    const sprite = makeLayer(makeTile({})).children[0] as Sprite
    expect(sprite.anchor.x).toBe(0)
    expect(sprite.anchor.y).toBe(0)
    expect(sprite.rotation).toBe(0)
    expect(sprite.position.x).toBe(0)
    expect(sprite.position.y).toBe(0)
  })

  it('H flip: anchor.x=1, scale.x=-1', () => {
    const sprite = makeLayer(makeTile({ horizontalFlip: true })).children[0] as Sprite
    expect(sprite.anchor.x).toBe(1)
    expect(sprite.anchor.y).toBe(0)
    expect(sprite.scale.x).toBe(-1)
    expect(sprite.rotation).toBe(0)
  })

  it('V flip: anchor.y=1, scale.y=-1', () => {
    const sprite = makeLayer(makeTile({ verticalFlip: true })).children[0] as Sprite
    expect(sprite.anchor.x).toBe(0)
    expect(sprite.anchor.y).toBe(1)
    expect(sprite.scale.y).toBe(-1)
    expect(sprite.rotation).toBe(0)
  })

  it('H+V flip (180°): anchor(1,1), scale(-1,-1)', () => {
    const sprite = makeLayer(
      makeTile({ horizontalFlip: true, verticalFlip: true })
    ).children[0] as Sprite
    expect(sprite.anchor.x).toBe(1)
    expect(sprite.anchor.y).toBe(1)
    expect(sprite.scale.x).toBe(-1)
    expect(sprite.scale.y).toBe(-1)
    expect(sprite.rotation).toBe(0)
  })
})

describe('applyFlip — diagonal (rotation)', () => {
  it('D+H (90° CW): anchor(0,1), scale(1,1), rotation=PI/2, no position shift', () => {
    const sprite = makeLayer(
      makeTile({ diagonalFlip: true, horizontalFlip: true })
    ).children[0] as Sprite
    expect(sprite.rotation).toBeCloseTo(Math.PI / 2)
    expect(sprite.anchor.x).toBe(0)
    expect(sprite.anchor.y).toBe(1)
    expect(sprite.scale.x).toBe(1)
    expect(sprite.scale.y).toBe(1)
    expect(sprite.position.x).toBe(0)
    expect(sprite.position.y).toBe(0)
  })

  it('D+V (90° CCW): anchor(1,0), scale(-1,-1), rotation=PI/2', () => {
    const sprite = makeLayer(
      makeTile({ diagonalFlip: true, verticalFlip: true })
    ).children[0] as Sprite
    expect(sprite.rotation).toBeCloseTo(Math.PI / 2)
    expect(sprite.anchor.x).toBe(1)
    expect(sprite.anchor.y).toBe(0)
    expect(sprite.scale.x).toBe(-1)
    expect(sprite.scale.y).toBe(-1)
    expect(sprite.position.x).toBe(0)
    expect(sprite.position.y).toBe(0)
  })

  it('D alone (transpose): anchor(0,0), scale(1,-1), rotation=PI/2', () => {
    const sprite = makeLayer(makeTile({ diagonalFlip: true })).children[0] as Sprite
    expect(sprite.rotation).toBeCloseTo(Math.PI / 2)
    expect(sprite.anchor.x).toBe(0)
    expect(sprite.anchor.y).toBe(0)
    expect(sprite.scale.x).toBe(1)
    expect(sprite.scale.y).toBe(-1)
    expect(sprite.position.x).toBe(0)
    expect(sprite.position.y).toBe(0)
  })

  it('D+H+V (270° CW): anchor(1,1), scale(-1,1), rotation=PI/2', () => {
    const sprite = makeLayer(
      makeTile({ diagonalFlip: true, horizontalFlip: true, verticalFlip: true })
    ).children[0] as Sprite
    expect(sprite.rotation).toBeCloseTo(Math.PI / 2)
    expect(sprite.anchor.x).toBe(1)
    expect(sprite.anchor.y).toBe(1)
    expect(sprite.scale.x).toBe(-1)
    expect(sprite.scale.y).toBe(1)
    expect(sprite.position.x).toBe(0)
    expect(sprite.position.y).toBe(0)
  })
})
