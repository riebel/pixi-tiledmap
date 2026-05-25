import { computeResolvedTilesetColumns } from '../resolvedDefaults.js'
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
  return computeResolvedTilesetColumns(ts)
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

/**
 * Finds the tileset entry whose firstgid range contains `gid`.
 * Accepts a key function to extract firstgid from arbitrary element types.
 * Returns undefined when no tileset matches.
 */
export function findTilesetForGid<T>(
  gid: number,
  tilesets: T[],
  getFirstGid: (t: T) => number
): T | undefined {
  for (let i = tilesets.length - 1; i >= 0; i--) {
    const ts = tilesets[i]
    if (ts && getFirstGid(ts) <= gid) return ts
  }
  return undefined
}
