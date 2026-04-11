import { describe, expect, it } from 'vitest'
import { decodeGid } from '../../src/parser/decodeGid.js'
import {
  FLIPPED_DIAGONALLY_FLAG,
  FLIPPED_HORIZONTALLY_FLAG,
  FLIPPED_VERTICALLY_FLAG
} from '../../src/types/index.js'

describe('decodeGid', () => {
  it('returns null for GID 0', () => {
    expect(decodeGid(0)).toBeNull()
  })

  it('decodes a plain GID with no flip flags', () => {
    const result = decodeGid(42)
    expect(result).toEqual({
      gid: 42,
      localId: 0,
      tilesetIndex: 0,
      horizontalFlip: false,
      verticalFlip: false,
      diagonalFlip: false
    })
  })

  it('detects horizontal flip flag', () => {
    const raw = 10 | FLIPPED_HORIZONTALLY_FLAG
    const result = decodeGid(raw)
    expect(result).not.toBeNull()
    expect(result!.gid).toBe(10)
    expect(result!.horizontalFlip).toBe(true)
    expect(result!.verticalFlip).toBe(false)
    expect(result!.diagonalFlip).toBe(false)
  })

  it('detects vertical flip flag', () => {
    const raw = 5 | FLIPPED_VERTICALLY_FLAG
    const result = decodeGid(raw)
    expect(result).not.toBeNull()
    expect(result!.gid).toBe(5)
    expect(result!.horizontalFlip).toBe(false)
    expect(result!.verticalFlip).toBe(true)
    expect(result!.diagonalFlip).toBe(false)
  })

  it('detects diagonal flip flag', () => {
    const raw = 7 | FLIPPED_DIAGONALLY_FLAG
    const result = decodeGid(raw)
    expect(result).not.toBeNull()
    expect(result!.gid).toBe(7)
    expect(result!.diagonalFlip).toBe(true)
  })

  it('detects all flip flags combined', () => {
    const raw = 1 | FLIPPED_HORIZONTALLY_FLAG | FLIPPED_VERTICALLY_FLAG | FLIPPED_DIAGONALLY_FLAG
    const result = decodeGid(raw)
    expect(result).not.toBeNull()
    expect(result!.gid).toBe(1)
    expect(result!.horizontalFlip).toBe(true)
    expect(result!.verticalFlip).toBe(true)
    expect(result!.diagonalFlip).toBe(true)
  })
})
