import { describe, expect, it } from 'vitest'
import { resolveTileInput } from '../src/resolvedTile.js'
import {
  FLIPPED_DIAGONALLY_FLAG,
  FLIPPED_HORIZONTALLY_FLAG,
  FLIPPED_VERTICALLY_FLAG
} from '../src/types/index.js'
import { makeResolvedTileset } from './helpers/resolved.js'

describe('Resolved Tile identity', () => {
  it('resolves raw GIDs with flip flags', () => {
    expect(
      resolveTileInput(
        11 | FLIPPED_HORIZONTALLY_FLAG | FLIPPED_VERTICALLY_FLAG | FLIPPED_DIAGONALLY_FLAG,
        [
          makeResolvedTileset({ name: 'base', firstgid: 1, tilecount: 4 }),
          makeResolvedTileset({ name: 'decor', firstgid: 10, tilecount: 4 })
        ]
      )
    ).toEqual({
      gid: 11,
      localId: 1,
      tilesetIndex: 1,
      horizontalFlip: true,
      verticalFlip: true,
      diagonalFlip: true
    })
  })

  it('resolves Local Tile IDs by tileset name, source, or image', () => {
    const tilesets = [
      makeResolvedTileset({
        name: 'decor',
        source: 'decor.tsx',
        image: 'decor.png',
        firstgid: 100,
        tilecount: 4
      })
    ]

    expect(resolveTileInput({ tileset: 'decor', tileId: 1 }, tilesets)?.gid).toBe(101)
    expect(resolveTileInput({ tileset: 'decor.tsx', tileId: 2 }, tilesets)?.gid).toBe(102)
    expect(resolveTileInput({ tileset: 'decor.png', tileId: 3 }, tilesets)?.gid).toBe(103)
  })
})
