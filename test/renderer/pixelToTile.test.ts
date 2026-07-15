import { describe, expect, it } from 'vitest'
import { pixelToTile, tileAt, tileToPixel } from '../../src/renderer/mapGeometry.js'
import type { MapContext, TileCell } from '../../src/types/index.js'
import { makeResolvedMap } from '../helpers/resolved.js'

/** The centre of a cell, which every orientation places half a tile past its anchor. */
function cellCentre(column: number, row: number, ctx: MapContext): { x: number; y: number } {
  const anchor = tileToPixel(column, row, ctx)
  return { x: anchor.x + ctx.tilewidth / 2, y: anchor.y + ctx.tileheight / 2 }
}

/**
 * An oracle independent of the code under test.
 *
 * Both diamonds (isometric, staggered) and regular hexagons are the Voronoi
 * cells of their centre lattice, so the cell covering a point is the one whose
 * centre is nearest. Diamonds are Voronoi under an L1 metric normalised by the
 * half-tile size; regular hexagons under plain Euclidean distance.
 */
function nearestCellCentre(
  x: number,
  y: number,
  ctx: MapContext,
  metric: 'l1' | 'l2',
  search: number
): TileCell {
  let best: TileCell = { column: 0, row: 0 }
  let bestDistance = Number.POSITIVE_INFINITY

  for (let row = -search; row <= search; row++) {
    for (let column = -search; column <= search; column++) {
      const centre = cellCentre(column, row, ctx)
      const dx = x - centre.x
      const dy = y - centre.y
      const distance =
        metric === 'l1'
          ? Math.abs(dx) / (ctx.tilewidth / 2) + Math.abs(dy) / (ctx.tileheight / 2)
          : Math.hypot(dx, dy)

      if (distance < bestDistance) {
        bestDistance = distance
        best = { column, row }
      }
    }
  }

  return best
}

/**
 * Samples the plane on an irregular step, chosen so no sample lands exactly on a
 * cell boundary where the oracle would tie.
 */
function expectMatchesOracle(ctx: MapContext, metric: 'l1' | 'l2', extent: number): void {
  const step = 3.7
  for (let y = -extent; y < extent; y += step) {
    for (let x = -extent; x < extent; x += step) {
      const expected = nearestCellCentre(x, y, ctx, metric, 6)
      expect({ x, y, ...pixelToTile(x, y, ctx) }).toEqual({ x, y, ...expected })
    }
  }
}

describe('pixelToTile - orthogonal', () => {
  const ctx: MapContext = {
    orientation: 'orthogonal',
    renderorder: 'right-down',
    tilewidth: 32,
    tileheight: 32
  }

  it('maps a point to the cell containing it', () => {
    expect(pixelToTile(0, 0, ctx)).toEqual({ column: 0, row: 0 })
    expect(pixelToTile(31, 31, ctx)).toEqual({ column: 0, row: 0 })
    expect(pixelToTile(32, 0, ctx)).toEqual({ column: 1, row: 0 })
    expect(pixelToTile(96, 64, ctx)).toEqual({ column: 3, row: 2 })
  })

  it('treats the cell boundary as half-open', () => {
    expect(pixelToTile(31.999, 0, ctx)).toEqual({ column: 0, row: 0 })
    expect(pixelToTile(32, 0, ctx)).toEqual({ column: 1, row: 0 })
  })

  it('returns negative cells left of and above the origin', () => {
    expect(pixelToTile(-1, -1, ctx)).toEqual({ column: -1, row: -1 })
  })

  it('inverts tileToPixel for every cell centre', () => {
    for (let row = 0; row < 6; row++) {
      for (let column = 0; column < 6; column++) {
        const centre = cellCentre(column, row, ctx)
        expect(pixelToTile(centre.x, centre.y, ctx)).toEqual({ column, row })
      }
    }
  })
})

describe('pixelToTile - isometric', () => {
  const ctx: MapContext = {
    orientation: 'isometric',
    renderorder: 'right-down',
    tilewidth: 64,
    tileheight: 32
  }

  it('inverts tileToPixel for every cell centre', () => {
    for (let row = 0; row < 6; row++) {
      for (let column = 0; column < 6; column++) {
        const centre = cellCentre(column, row, ctx)
        expect(pixelToTile(centre.x, centre.y, ctx)).toEqual({ column, row })
      }
    }
  })

  it('maps the origin to the cell left of the map, which isometric maps reach', () => {
    expect(pixelToTile(0, 0, ctx)).toEqual({ column: -1, row: 0 })
  })

  it('agrees with a nearest-centre oracle across the plane', () => {
    expectMatchesOracle(ctx, 'l1', 60)
  })
})

describe('pixelToTile - staggered', () => {
  const axes = ['x', 'y'] as const
  const indices = ['odd', 'even'] as const

  for (const staggeraxis of axes) {
    for (const staggerindex of indices) {
      describe(`${staggeraxis}-axis, ${staggerindex}`, () => {
        const ctx: MapContext = {
          orientation: 'staggered',
          renderorder: 'right-down',
          tilewidth: 64,
          tileheight: 32,
          staggeraxis,
          staggerindex
        }

        it('inverts tileToPixel for every cell centre', () => {
          for (let row = 0; row < 6; row++) {
            for (let column = 0; column < 6; column++) {
              const centre = cellCentre(column, row, ctx)
              expect(pixelToTile(centre.x, centre.y, ctx)).toEqual({ column, row })
            }
          }
        })

        it('agrees with a nearest-centre oracle across the plane', () => {
          expectMatchesOracle(ctx, 'l1', 60)
        })
      })
    }
  }
})

describe('pixelToTile - hexagonal', () => {
  const axes = ['x', 'y'] as const
  const indices = ['odd', 'even'] as const

  for (const staggeraxis of axes) {
    for (const staggerindex of indices) {
      describe(`${staggeraxis}-axis, ${staggerindex}`, () => {
        // Regular hexagon dimensions, so the nearest-centre oracle is exact:
        // side 32, point-to-point 64, flat-to-flat 32*sqrt(3).
        const side = 32
        const long = 2 * side
        const short = side * Math.sqrt(3)
        const ctx: MapContext = {
          orientation: 'hexagonal',
          renderorder: 'right-down',
          tilewidth: staggeraxis === 'x' ? long : short,
          tileheight: staggeraxis === 'x' ? short : long,
          hexsidelength: side,
          staggeraxis,
          staggerindex
        }

        it('inverts tileToPixel for every cell centre', () => {
          for (let row = 0; row < 6; row++) {
            for (let column = 0; column < 6; column++) {
              const centre = cellCentre(column, row, ctx)
              expect(pixelToTile(centre.x, centre.y, ctx)).toEqual({ column, row })
            }
          }
        })

        it('agrees with a nearest-centre oracle across the plane', () => {
          expectMatchesOracle(ctx, 'l2', 60)
        })
      })
    }
  }
})

describe('tileAt', () => {
  it('resolves a point inside the map', () => {
    const map = makeResolvedMap({ width: 4, height: 3, tilewidth: 16, tileheight: 16 })
    expect(tileAt(map, 20, 40)).toEqual({ column: 1, row: 2 })
  })

  it('returns null outside the map rather than clamping to an edge cell', () => {
    const map = makeResolvedMap({ width: 4, height: 3, tilewidth: 16, tileheight: 16 })

    expect(tileAt(map, -1, 0)).toBeNull()
    expect(tileAt(map, 0, -1)).toBeNull()
    expect(tileAt(map, 64, 0)).toBeNull()
    expect(tileAt(map, 0, 48)).toBeNull()
  })

  it('accepts the last pixel inside the map and rejects the first outside', () => {
    const map = makeResolvedMap({ width: 4, height: 3, tilewidth: 16, tileheight: 16 })

    expect(tileAt(map, 63.999, 47.999)).toEqual({ column: 3, row: 2 })
    expect(tileAt(map, 64, 47)).toBeNull()
  })

  it('rejects the negative-x half of an isometric map that holds no cells', () => {
    const map = makeResolvedMap({
      orientation: 'isometric',
      width: 4,
      height: 4,
      tilewidth: 64,
      tileheight: 32
    })

    // The centre of cell (0, 3) sits at negative x and is still in the map.
    expect(tileAt(map, -64, 64)).toEqual({ column: 0, row: 3 })
    // Further left there are no cells at all.
    expect(tileAt(map, -160, 64)).toBeNull()
  })
})
