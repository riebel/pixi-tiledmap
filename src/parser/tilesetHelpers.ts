import type { TiledTileset, TiledTilesetRef } from '../types'

export function isTilesetRef(ts: TiledTileset | TiledTilesetRef): ts is TiledTilesetRef {
  return 'source' in ts && !('name' in ts)
}

interface ColumnsSource {
  columns?: number
  imagewidth?: number
  tilewidth: number
  margin: number
  spacing: number
}

export function computeTilesetColumns(ts: ColumnsSource): number {
  if (ts.columns && ts.columns > 0) return ts.columns
  if (!ts.imagewidth || ts.tilewidth <= 0) return 0
  return Math.floor((ts.imagewidth - 2 * ts.margin + ts.spacing) / (ts.tilewidth + ts.spacing))
}

/**
 * Finds the index of the tileset whose firstgid range contains `gid`.
 * Works with any array where each element exposes `firstgid`.
 * Returns -1 when no tileset matches.
 */
export function findTilesetIndexForGid(gid: number, tilesets: { firstgid: number }[]): number {
  for (let i = tilesets.length - 1; i >= 0; i--) {
    const ts = tilesets[i]
    if (ts && ts.firstgid <= gid) return i
  }
  return -1
}
