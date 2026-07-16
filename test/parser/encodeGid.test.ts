import { describe, expect, it } from 'vitest'
import { decodeGid } from '../../src/parser/decodeGid.js'
import { encodeGid } from '../../src/parser/encodeGid.js'
import {
  FLIPPED_DIAGONALLY_FLAG,
  FLIPPED_HORIZONTALLY_FLAG,
  FLIPPED_VERTICALLY_FLAG,
  ROTATED_HEXAGONAL_120_FLAG
} from '../../src/types/index.js'
import { makeResolvedTile } from '../helpers/resolved.js'

const FLAGS = [
  FLIPPED_HORIZONTALLY_FLAG,
  FLIPPED_VERTICALLY_FLAG,
  FLIPPED_DIAGONALLY_FLAG,
  ROTATED_HEXAGONAL_120_FLAG
] as const

/** Every combination of the four GID bit flags. */
function flagMatrix(): number[] {
  const combinations: number[] = []
  for (let mask = 0; mask < 1 << FLAGS.length; mask++) {
    let flags = 0
    for (let bit = 0; bit < FLAGS.length; bit++) {
      if (mask & (1 << bit)) flags |= FLAGS[bit]!
    }
    combinations.push(flags >>> 0)
  }
  return combinations
}

describe('encodeGid', () => {
  it('encodes an empty cell as GID 0', () => {
    expect(encodeGid(null)).toBe(0)
  })

  it('encodes a plain tile as its bare GID', () => {
    expect(encodeGid(makeResolvedTile({ gid: 42 }))).toBe(42)
  })

  it('sets each flip flag', () => {
    expect(encodeGid(makeResolvedTile({ gid: 10, horizontalFlip: true }))).toBe(
      (10 | FLIPPED_HORIZONTALLY_FLAG) >>> 0
    )
    expect(encodeGid(makeResolvedTile({ gid: 5, verticalFlip: true }))).toBe(
      (5 | FLIPPED_VERTICALLY_FLAG) >>> 0
    )
    expect(encodeGid(makeResolvedTile({ gid: 7, diagonalFlip: true }))).toBe(
      (7 | FLIPPED_DIAGONALLY_FLAG) >>> 0
    )
    expect(encodeGid(makeResolvedTile({ gid: 3, rotatedHex120: true }))).toBe(
      (3 | ROTATED_HEXAGONAL_120_FLAG) >>> 0
    )
  })

  it('returns an unsigned GID once the high flip bit is set', () => {
    expect(encodeGid(makeResolvedTile({ gid: 1, horizontalFlip: true }))).toBeGreaterThan(0)
  })

  it('ignores runtime-only alpha, which no GID can carry', () => {
    expect(encodeGid(makeResolvedTile({ gid: 12, alpha: 0.5 }))).toBe(12)
  })

  it('round-trips decodeGid across the whole flag matrix', () => {
    for (const flags of flagMatrix()) {
      const raw = (1234 | flags) >>> 0
      expect(encodeGid(decodeGid(raw))).toBe(raw)
    }
  })

  it('round-trips a tile with every flag set', () => {
    const raw =
      (99 |
        FLIPPED_HORIZONTALLY_FLAG |
        FLIPPED_VERTICALLY_FLAG |
        FLIPPED_DIAGONALLY_FLAG |
        ROTATED_HEXAGONAL_120_FLAG) >>>
      0
    const tile = decodeGid(raw)

    expect(tile).toMatchObject({
      gid: 99,
      horizontalFlip: true,
      verticalFlip: true,
      diagonalFlip: true,
      rotatedHex120: true
    })
    expect(encodeGid(tile)).toBe(raw)
  })

  it('leaves the hex rotation bit off tiles that do not carry it', () => {
    expect(decodeGid(5)).not.toHaveProperty('rotatedHex120')
  })
})
