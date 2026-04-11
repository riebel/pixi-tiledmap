import { describe, expect, it } from 'vitest'
import type { MapContext } from '../../src/renderer/tilePlacement.js'
import { tileToPixel } from '../../src/renderer/tilePlacement.js'

describe('tileToPixel', () => {
  describe('orthogonal', () => {
    const ctx: MapContext = {
      orientation: 'orthogonal',
      renderorder: 'right-down',
      tilewidth: 32,
      tileheight: 32
    }

    it('places (0,0) at origin', () => {
      expect(tileToPixel(0, 0, ctx)).toEqual({ x: 0, y: 0 })
    })

    it('places (1,0) one tile to the right', () => {
      expect(tileToPixel(1, 0, ctx)).toEqual({ x: 32, y: 0 })
    })

    it('places (0,1) one tile down', () => {
      expect(tileToPixel(0, 1, ctx)).toEqual({ x: 0, y: 32 })
    })

    it('places (3,2) at correct position', () => {
      expect(tileToPixel(3, 2, ctx)).toEqual({ x: 96, y: 64 })
    })
  })

  describe('isometric', () => {
    const ctx: MapContext = {
      orientation: 'isometric',
      renderorder: 'right-down',
      tilewidth: 64,
      tileheight: 32
    }

    it('places (0,0) at origin', () => {
      expect(tileToPixel(0, 0, ctx)).toEqual({ x: 0, y: 0 })
    })

    it('places (1,0) at half-width right and half-height down', () => {
      expect(tileToPixel(1, 0, ctx)).toEqual({ x: 32, y: 16 })
    })

    it('places (0,1) at half-width left and half-height down', () => {
      expect(tileToPixel(0, 1, ctx)).toEqual({ x: -32, y: 16 })
    })

    it('places (1,1) at zero-x and full-height down', () => {
      expect(tileToPixel(1, 1, ctx)).toEqual({ x: 0, y: 32 })
    })
  })

  describe('staggered (Y-axis, odd)', () => {
    const ctx: MapContext = {
      orientation: 'staggered',
      renderorder: 'right-down',
      tilewidth: 64,
      tileheight: 32,
      staggeraxis: 'y',
      staggerindex: 'odd'
    }

    it('places (0,0) at origin (even row, not staggered)', () => {
      expect(tileToPixel(0, 0, ctx)).toEqual({ x: 0, y: 0 })
    })

    it('staggers odd rows by half tile width', () => {
      const pos = tileToPixel(0, 1, ctx)
      expect(pos.x).toBe(32) // staggered by tilewidth/2
      expect(pos.y).toBe(16) // row * tileheight/2
    })

    it('even row 2 is not staggered', () => {
      const pos = tileToPixel(0, 2, ctx)
      expect(pos.x).toBe(0)
      expect(pos.y).toBe(32)
    })
  })

  describe('hexagonal (Y-axis, odd)', () => {
    const ctx: MapContext = {
      orientation: 'hexagonal',
      renderorder: 'right-down',
      tilewidth: 64,
      tileheight: 64,
      hexsidelength: 32,
      staggeraxis: 'y',
      staggerindex: 'odd'
    }

    it('places (0,0) at origin', () => {
      expect(tileToPixel(0, 0, ctx)).toEqual({ x: 0, y: 0 })
    })

    it('staggers odd rows by half tile width', () => {
      const pos = tileToPixel(0, 1, ctx)
      expect(pos.x).toBe(32)
      // rowHeight = (64 + 32) / 2 = 48
      expect(pos.y).toBe(48)
    })

    it('even row 2 is not staggered', () => {
      const pos = tileToPixel(0, 2, ctx)
      expect(pos.x).toBe(0)
      expect(pos.y).toBe(96)
    })

    it('col 1 is one tilewidth to the right', () => {
      const pos = tileToPixel(1, 0, ctx)
      expect(pos.x).toBe(64)
      expect(pos.y).toBe(0)
    })
  })

  describe('hexagonal (X-axis, even)', () => {
    const ctx: MapContext = {
      orientation: 'hexagonal',
      renderorder: 'right-down',
      tilewidth: 64,
      tileheight: 64,
      hexsidelength: 32,
      staggeraxis: 'x',
      staggerindex: 'even'
    }

    it('places (0,0) staggered (even col)', () => {
      const pos = tileToPixel(0, 0, ctx)
      expect(pos.x).toBe(0)
      // even col is staggered → y offset = tileheight/2 = 32
      expect(pos.y).toBe(32)
    })

    it('odd col 1 is not staggered', () => {
      const pos = tileToPixel(1, 0, ctx)
      // colWidth = (64 + 32) / 2 = 48
      expect(pos.x).toBe(48)
      expect(pos.y).toBe(0)
    })
  })
})
