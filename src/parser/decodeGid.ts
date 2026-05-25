import { decodeTileGid } from '../resolvedTile.js'
import type { ResolvedTile } from '../types'

export function decodeGid(raw: number): ResolvedTile | null {
  return decodeTileGid(raw)
}
