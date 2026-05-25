/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import {
  getMapTileDrawRect,
  getTileUvKey,
  getTileUvOrder,
  needsMapTileVisual
} from '../../src/renderer/tileDrawPlan.js'
import type { MapContext, TiledTileDefinition } from '../../src/types/index.js'
import { makeResolvedTile, makeTileSetRenderer } from '../helpers/resolved.js'

const ctx: MapContext = {
  orientation: 'orthogonal',
  renderorder: 'right-down',
  tilewidth: 32,
  tileheight: 32,
  tileSpritePadding: 2
}

describe('Map Tile draw plan', () => {
  it('computes the canonical map tile draw rectangle', () => {
    const tile = makeResolvedTile({ alpha: 0.5 })
    const ts = makeTileSetRenderer({
      tilewidth: 16,
      tileheight: 16,
      tileoffset: { x: 5, y: -3 }
    })

    expect(getMapTileDrawRect(tile, ts, 10, 20, ctx)).toEqual({
      x: 15,
      y: 33,
      width: 16,
      height: 16,
      alpha: 0.5
    })
  })

  it('adds padding only to full-size orthogonal map tiles', () => {
    const tile = makeResolvedTile()
    const fullSize = makeTileSetRenderer({ tilewidth: 32, tileheight: 32 })
    const small = makeTileSetRenderer({ tilewidth: 16, tileheight: 16 })

    expect(getMapTileDrawRect(tile, fullSize, 0, 0, ctx)).toMatchObject({
      width: 34,
      height: 34
    })
    expect(getMapTileDrawRect(tile, small, 0, 0, ctx)).toMatchObject({
      width: 16,
      height: 16
    })
  })

  it('identifies map tiles that need Tile Visuals', () => {
    const animated = new Map<number, TiledTileDefinition>([
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

    expect(needsMapTileVisual(makeResolvedTile(), makeTileSetRenderer())).toBe(false)
    expect(
      needsMapTileVisual(
        makeResolvedTile(),
        makeTileSetRenderer({ tiles: animated, columns: 2, tilecount: 2 })
      )
    ).toBe(true)
  })

  it('computes stable UV identity from Local Tile ID and flip flags', () => {
    const tile = makeResolvedTile({
      localId: 3,
      horizontalFlip: true,
      diagonalFlip: true
    })

    expect(getTileUvKey(tile)).toBe(29)
    expect(getTileUvOrder(tile)).toEqual([3, 0, 1, 2])
  })
})
