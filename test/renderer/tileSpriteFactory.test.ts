/**
 * @vitest-environment jsdom
 */
import { AnimatedSprite, Sprite, Texture } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { TileSetRenderer } from '../../src/renderer/TileSetRenderer.js'
import { createTileSprite } from '../../src/renderer/tileSpriteFactory.js'
import type { MapContext, ResolvedTileset, TiledTileDefinition } from '../../src/types/index.js'
import { makeResolvedTile, makeResolvedTileset, makeTileSetRenderer } from '../helpers/resolved.js'

const SIZE = 32

const ctx: MapContext = {
  orientation: 'orthogonal',
  renderorder: 'right-down',
  tilewidth: SIZE,
  tileheight: SIZE,
  tileSpritePadding: 0
}

function makeTileset(overrides?: Partial<ResolvedTileset>): TileSetRenderer {
  return makeTileSetRenderer({
    tilewidth: SIZE,
    tileheight: SIZE,
    ...overrides
  })
}

describe('createTileSprite', () => {
  it('returns null when no texture available', () => {
    const ts = new TileSetRenderer(
      {
        ...makeResolvedTileset({
          tilewidth: SIZE,
          tileheight: SIZE
        })
      },
      null
    )
    expect(createTileSprite(makeResolvedTile(), ts, 0, 0, ctx)).toBeNull()
  })

  it('creates a Sprite positioned at (px, py) when tile fills the grid cell', () => {
    const sprite = createTileSprite(makeResolvedTile(), makeTileset(), 64, 96, ctx)
    expect(sprite).toBeInstanceOf(Sprite)
    expect(sprite!.position.x).toBe(64)
    expect(sprite!.position.y).toBe(96)
  })

  it('applies tileoffset to position', () => {
    const ts = makeTileset({ tileoffset: { x: 5, y: -3 } })
    const sprite = createTileSprite(makeResolvedTile(), ts, 10, 20, ctx)
    expect(sprite!.position.x).toBe(15)
    expect(sprite!.position.y).toBe(17)
  })

  it('offsets y by (tileheight - renderH) when tile is smaller than grid cell', () => {
    // tile is 16x16, map grid is 32x32 → y offset = 32 - 16 = 16
    const ts = makeTileset({ tilewidth: 16, tileheight: 16 })
    const sprite = createTileSprite(makeResolvedTile(), ts, 0, 0, ctx)
    expect(sprite!.position.y).toBe(16)
  })

  it('sets sprite width and height to render size', () => {
    const sprite = createTileSprite(makeResolvedTile(), makeTileset(), 0, 0, ctx)
    expect(sprite!.width).toBe(SIZE)
    expect(sprite!.height).toBe(SIZE)
  })

  it('adds tileSpritePadding to size for orthogonal tiles that match grid', () => {
    const paddedCtx: MapContext = { ...ctx, tileSpritePadding: 2 }
    const sprite = createTileSprite(makeResolvedTile(), makeTileset(), 0, 0, paddedCtx)
    expect(sprite!.width).toBe(SIZE + 2)
    expect(sprite!.height).toBe(SIZE + 2)
  })

  it('does not add padding when tile size differs from grid size', () => {
    const paddedCtx: MapContext = { ...ctx, tileSpritePadding: 2 }
    const ts = makeTileset({ tilewidth: 16, tileheight: 16 })
    const sprite = createTileSprite(makeResolvedTile(), ts, 0, 0, paddedCtx)
    expect(sprite!.width).toBe(16)
    expect(sprite!.height).toBe(16)
  })

  it('applies horizontal flip', () => {
    const sprite = createTileSprite(
      makeResolvedTile({ horizontalFlip: true }),
      makeTileset(),
      0,
      0,
      ctx
    )
    // The 1px test texture is stretched to the 32px cell, mirrored.
    expect(sprite!.scale.x).toBe(-SIZE)
    expect(sprite!.scale.y).toBe(SIZE)
    expect(sprite!.anchor.x).toBe(1)
    expect(sprite!.getBounds()).toMatchObject({ x: 0, y: 0, width: SIZE, height: SIZE })
  })

  it('keeps the cell size for every flip combination', () => {
    for (const [horizontalFlip, verticalFlip, diagonalFlip] of [
      [true, false, false],
      [false, true, false],
      [true, true, false],
      [false, false, true],
      [true, false, true],
      [false, true, true],
      [true, true, true]
    ]) {
      const sprite = createTileSprite(
        makeResolvedTile({ horizontalFlip, verticalFlip, diagonalFlip }),
        makeTileset(),
        64,
        96,
        ctx
      )
      const bounds = sprite!.getBounds()
      expect(bounds.x).toBeCloseTo(64)
      expect(bounds.y).toBeCloseTo(96)
      expect(bounds.width).toBeCloseTo(SIZE)
      expect(bounds.height).toBeCloseTo(SIZE)
    }
  })

  it('transposes a diagonally flipped non-square tile about its bottom-left corner', () => {
    // A 32x16 tile in a 32px cell covers x 0..32, y 16..32. Tiled draws it
    // turned: 16 wide and 32 tall, still ending at the bottom-left corner.
    const ts = makeTileset({ tilewidth: 32, tileheight: 16 })
    const sprite = createTileSprite(makeResolvedTile({ diagonalFlip: true }), ts, 0, 0, ctx)
    const bounds = sprite!.getBounds()
    expect(bounds.x).toBeCloseTo(0)
    expect(bounds.y).toBeCloseTo(0)
    expect(bounds.width).toBeCloseTo(16)
    expect(bounds.height).toBeCloseTo(32)
  })

  it('centers a preserve-aspect-fit grid tile in its cell and scales its offset', () => {
    // 16x8 tile in a 32px grid cell: fitted to 32x16, centered vertically.
    const ts = makeTileset({
      tilewidth: 16,
      tileheight: 8,
      tilerendersize: 'grid',
      fillmode: 'preserve-aspect-fit',
      tileoffset: { x: 1, y: 0 }
    })
    const sprite = createTileSprite(makeResolvedTile(), ts, 0, 0, ctx)
    const bounds = sprite!.getBounds()
    expect(bounds.x).toBeCloseTo(2)
    expect(bounds.y).toBeCloseTo(8)
    expect(bounds.width).toBeCloseTo(32)
    expect(bounds.height).toBeCloseTo(16)
  })

  it('creates AnimatedSprite for multi-frame tiles', () => {
    const tiles = new Map<number, TiledTileDefinition>([
      [
        0,
        {
          id: 0,
          animation: [
            { tileid: 0, duration: 100 },
            { tileid: 1, duration: 100 }
          ]
        }
      ]
    ])
    const ts = makeTileset({ tiles, columns: 2, tilecount: 2 })
    ts.setTileTexture(1, Texture.EMPTY)
    const sprite = createTileSprite(makeResolvedTile(), ts, 0, 0, ctx)
    expect(sprite).toBeInstanceOf(AnimatedSprite)
  })

  it('returns null when an animation frame texture is missing', () => {
    const tiles = new Map<number, TiledTileDefinition>([
      [
        0,
        {
          id: 0,
          animation: [
            { tileid: 0, duration: 100 },
            { tileid: 99, duration: 100 }
          ]
        }
      ]
    ])
    const ts = makeTileset({ tiles, columns: 100, tilecount: 100 })
    // tileid 99 has no texture set → factory returns null
    const sprite = createTileSprite(makeResolvedTile(), ts, 0, 0, ctx)
    expect(sprite).toBeNull()
  })
})
