import { describe, expect, it } from 'vitest'
import {
  computeMapBounds,
  computeMapPixelSize,
  getTileIterationPlan,
  pixelToTile,
  tileToPixel
} from '../../src/renderer/mapGeometry.js'
import type { MapContext } from '../../src/types/index.js'
import { makeResolvedMap } from '../helpers/resolved.js'

describe('computeMapPixelSize', () => {
  it('computes orthogonal extents', () => {
    expect(
      computeMapPixelSize(makeResolvedMap({ width: 3, height: 2, tilewidth: 16, tileheight: 8 }))
    ).toEqual({ width: 48, height: 16 })
  })

  it('computes isometric extents', () => {
    expect(
      computeMapPixelSize(
        makeResolvedMap({
          orientation: 'isometric',
          width: 3,
          height: 2,
          tilewidth: 64,
          tileheight: 32
        })
      )
    ).toEqual({ width: 160, height: 80 })
  })

  it('computes x-staggered extents', () => {
    expect(
      computeMapPixelSize(
        makeResolvedMap({
          orientation: 'staggered',
          staggeraxis: 'x',
          width: 3,
          height: 2,
          tilewidth: 64,
          tileheight: 32
        })
      )
    ).toEqual({ width: 128, height: 80 })
  })
})

describe('computeMapBounds follows Tiled', () => {
  it('uses the hexagon side length on both stagger axes', () => {
    const hex = {
      orientation: 'hexagonal',
      width: 4,
      height: 4,
      tilewidth: 32,
      tileheight: 32
    } as const
    expect(
      computeMapPixelSize(makeResolvedMap({ ...hex, hexsidelength: 16, staggeraxis: 'y' }))
    ).toEqual({ width: 144, height: 104 })
    expect(
      computeMapPixelSize(makeResolvedMap({ ...hex, hexsidelength: 16, staggeraxis: 'x' }))
    ).toEqual({ width: 104, height: 144 })
  })

  it('adds the stagger half-tile only when there is a second row or column', () => {
    const staggered = { orientation: 'staggered', tilewidth: 64, tileheight: 32 } as const
    expect(
      computeMapPixelSize(makeResolvedMap({ ...staggered, staggeraxis: 'y', width: 3, height: 1 }))
    ).toEqual({ width: 192, height: 32 })
    expect(
      computeMapPixelSize(makeResolvedMap({ ...staggered, staggeraxis: 'x', width: 1, height: 2 }))
    ).toEqual({ width: 64, height: 64 })
  })

  it('starts isometric bounds where the leftmost tile is drawn', () => {
    const map = makeResolvedMap({
      orientation: 'isometric',
      width: 4,
      height: 4,
      tilewidth: 32,
      tileheight: 16
    })
    const ctx: MapContext = { ...map }
    // Tile (0, 3) is the leftmost; its image starts at its anchor.
    expect(computeMapBounds(map)).toEqual({
      x: tileToPixel(0, 3, ctx).x,
      y: 0,
      width: 128,
      height: 64
    })
  })

  it('shears oblique bounds, reaching left of the origin for a negative skew', () => {
    const map = makeResolvedMap({
      orientation: 'oblique',
      width: 4,
      height: 2,
      tilewidth: 16,
      tileheight: 16,
      skewx: -8
    })
    expect(computeMapBounds(map)).toEqual({ x: -16, y: 0, width: 80, height: 32 })
  })
})

describe('oblique tiles', () => {
  const ctx: MapContext = {
    orientation: 'oblique',
    renderorder: 'right-down',
    tilewidth: 16,
    tileheight: 16,
    skewx: 8,
    skewy: 4
  }

  it('anchors a tile so its bottom-left corner sits on the sheared cell corner', () => {
    // Cell (2, 1) has its bottom-left at (32, 32) before shearing:
    // x' = 32 + 8 / 16 * 32 = 48, y' = 4 / 16 * 32 + 32 = 40.
    const anchor = tileToPixel(2, 1, ctx)
    expect(anchor.x).toBe(48)
    expect(anchor.y + ctx.tileheight).toBe(40)
  })

  it('maps every sheared cell centre back to its cell', () => {
    for (let row = -2; row <= 3; row++) {
      for (let column = -2; column <= 3; column++) {
        const u = (column + 0.5) * 16
        const v = (row + 0.5) * 16
        const x = u + (8 / 16) * v
        const y = (4 / 16) * u + v
        expect(pixelToTile(x, y, ctx)).toEqual({ column, row })
      }
    }
  })
})

describe('getTileIterationPlan', () => {
  it('plans right-down by row then column', () => {
    expect(getTileIterationPlan(2, 2, { renderorder: 'right-down' })).toEqual({
      rowStart: 0,
      rowEnd: 2,
      rowStep: 1,
      colStart: 0,
      colEnd: 2,
      colStep: 1
    })
  })

  it('plans left-up from bottom-right to top-left', () => {
    expect(getTileIterationPlan(2, 2, { renderorder: 'left-up' })).toEqual({
      rowStart: 1,
      rowEnd: -1,
      rowStep: -1,
      colStart: 1,
      colEnd: -1,
      colStep: -1
    })
  })
})
