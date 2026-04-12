/**
 * @vitest-environment jsdom
 */
import { Texture } from 'pixi.js'
import { describe, expect, it, vi } from 'vitest'
import { TileSetRenderer } from '../../src/renderer/TileSetRenderer.js'
import type { MapContext } from '../../src/renderer/tilePlacement.js'
import type { ResolvedTileset, TiledTileDefinition } from '../../src/types/index.js'

const ctx: MapContext = {
  orientation: 'orthogonal',
  renderorder: 'right-down',
  tilewidth: 32,
  tileheight: 32
}

function makeTileset(overrides?: Partial<ResolvedTileset>): ResolvedTileset {
  return {
    firstgid: 1,
    name: 'test',
    tilewidth: 64,
    tileheight: 64,
    columns: 4,
    tilecount: 16,
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

describe('TileSetRenderer.getRenderSize', () => {
  it('returns intrinsic size when tilerendersize is "tile"', () => {
    const ts = new TileSetRenderer(makeTileset({ tilerendersize: 'tile' }), null)
    expect(ts.getRenderSize(0, ctx)).toEqual({ width: 64, height: 64 })
  })

  it('returns map grid size when tilerendersize is "grid" with stretch', () => {
    const ts = new TileSetRenderer(
      makeTileset({ tilerendersize: 'grid', fillmode: 'stretch' }),
      null
    )
    expect(ts.getRenderSize(0, ctx)).toEqual({ width: 32, height: 32 })
  })

  it('preserves aspect ratio when fillmode is "preserve-aspect-fit"', () => {
    // tile is 64x32 intrinsic, grid is 32x32 → scale = min(0.5, 1) = 0.5
    const tileDef: TiledTileDefinition = { id: 0, image: 't.png', imagewidth: 64, imageheight: 32 }
    const tiles = new Map<number, TiledTileDefinition>([[0, tileDef]])
    const ts = new TileSetRenderer(
      makeTileset({
        tilerendersize: 'grid',
        fillmode: 'preserve-aspect-fit',
        tiles
      }),
      null
    )
    expect(ts.getRenderSize(0, ctx)).toEqual({ width: 32, height: 16 })
  })

  it('returns image-collection intrinsic size when tilerendersize is "tile"', () => {
    const tileDef: TiledTileDefinition = { id: 5, image: 't.png', imagewidth: 48, imageheight: 24 }
    const tiles = new Map<number, TiledTileDefinition>([[5, tileDef]])
    const ts = new TileSetRenderer(makeTileset({ tiles }), null)
    expect(ts.getRenderSize(5, ctx)).toEqual({ width: 48, height: 24 })
  })
})

describe('ResolvedTileset.tileoffset', () => {
  it('is exposed on the tileset for the renderer to apply', () => {
    const ts = new TileSetRenderer(makeTileset({ tileoffset: { x: 5, y: -10 } }), null)
    expect(ts.tileset.tileoffset).toEqual({ x: 5, y: -10 })
  })
})

describe('TileSetRenderer.destroy', () => {
  it('does not destroy externally supplied tile textures', () => {
    const tileDef: TiledTileDefinition = { id: 0, image: 't.png', imagewidth: 32, imageheight: 32 }
    const tiles = new Map<number, TiledTileDefinition>([[0, tileDef]])
    const ts = new TileSetRenderer(makeTileset({ tiles }), null)

    const external = Texture.EMPTY
    const destroySpy = vi.spyOn(external, 'destroy')
    ts.setTileTexture(0, external)

    expect(ts.getTexture(0)).toBe(external)
    ts.destroy()

    expect(destroySpy).not.toHaveBeenCalled()
    destroySpy.mockRestore()
  })
})
