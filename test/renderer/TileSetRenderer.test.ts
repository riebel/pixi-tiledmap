/**
 * @vitest-environment jsdom
 */
import { CanvasSource, Texture } from 'pixi.js'
import { describe, expect, it, vi } from 'vitest'
import { TileSetRenderer } from '../../src/renderer/TileSetRenderer.js'
import type { MapContext, ResolvedTileset, TiledTileDefinition } from '../../src/types/index.js'
import { makeResolvedTileset } from '../helpers/resolved.js'

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

describe('TileSetRenderer image sub-rectangles', () => {
  function imageTexture(): Texture {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 32
    return new Texture({ source: new CanvasSource({ resource: canvas }) })
  }

  it('draws only the part of a tile image the tile names, at that size', () => {
    const renderer = new TileSetRenderer(
      makeResolvedTileset({
        tiles: new Map([[0, { id: 0, image: 'sheet.png', x: 16, y: 8, width: 24, height: 12 }]])
      }),
      null
    )
    const image = imageTexture()
    renderer.setTileTexture(0, image)

    const texture = renderer.getTexture(0)!
    expect(texture).not.toBe(image)
    expect(texture.frame).toMatchObject({ x: 16, y: 8, width: 24, height: 12 })
    expect(renderer.getTileSize(0)).toEqual({ width: 24, height: 12 })

    renderer.destroy()
    expect(texture.destroyed).toBe(true)
    expect(image.destroyed).toBe(false)
  })

  it('uses a tile image whole when the tile names no part of it', () => {
    const renderer = new TileSetRenderer(
      makeResolvedTileset({ tiles: new Map([[0, { id: 0, image: 'whole.png' }]]) }),
      null
    )
    const image = imageTexture()
    renderer.setTileTexture(0, image)
    expect(renderer.getTexture(0)).toBe(image)
  })
})
