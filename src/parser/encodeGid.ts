import type { ResolvedTile } from '../types'
import {
  FLIPPED_DIAGONALLY_FLAG,
  FLIPPED_HORIZONTALLY_FLAG,
  FLIPPED_VERTICALLY_FLAG,
  ROTATED_HEXAGONAL_120_FLAG
} from '../types/index.js'

/**
 * Packs a `ResolvedTile` back into a raw Tiled GID: the exact inverse of
 * `decodeGid`. An empty cell (`null`) encodes as GID 0.
 *
 * `ResolvedTile.alpha` is a runtime-only render property and has no GID
 * representation, so it is not encoded.
 */
export function encodeGid(tile: ResolvedTile | null): number {
  if (!tile) return 0

  let raw = tile.gid
  if (tile.horizontalFlip) raw |= FLIPPED_HORIZONTALLY_FLAG
  if (tile.verticalFlip) raw |= FLIPPED_VERTICALLY_FLAG
  if (tile.diagonalFlip) raw |= FLIPPED_DIAGONALLY_FLAG
  if (tile.rotatedHex120) raw |= ROTATED_HEXAGONAL_120_FLAG

  // The flag bits make this exceed the signed 32-bit range that `|` works in.
  return raw >>> 0
}
