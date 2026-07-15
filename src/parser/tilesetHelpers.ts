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
