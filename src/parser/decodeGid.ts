import type { ResolvedTile } from '../types'
import {
  FLIPPED_DIAGONALLY_FLAG,
  FLIPPED_HORIZONTALLY_FLAG,
  FLIPPED_VERTICALLY_FLAG,
  GID_MASK
} from '../types'

export function decodeGid(raw: number): ResolvedTile | null {
  const gid = raw & GID_MASK
  if (gid === 0) return null

  return {
    gid,
    localId: 0,
    tilesetIndex: 0,
    horizontalFlip: (raw & FLIPPED_HORIZONTALLY_FLAG) !== 0,
    verticalFlip: (raw & FLIPPED_VERTICALLY_FLAG) !== 0,
    diagonalFlip: (raw & FLIPPED_DIAGONALLY_FLAG) !== 0
  }
}
