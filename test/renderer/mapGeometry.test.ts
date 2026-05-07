import { describe, expect, it } from 'vitest'
import { computeMapPixelSize, getTileIterationPlan } from '../../src/renderer/mapGeometry.js'
import { makeResolvedMap } from '../helpers/resolved.js'

describe('computeMapPixelSize', () => {
  it('computes orthogonal extents', () => {
    expect(
      computeMapPixelSize(makeResolvedMap({ width: 3, height: 2, tilewidth: 16, tileheight: 8 }))
    ).toEqual({ width: 48, height: 16 })
  })

  it('computes isometric extents', () => {
    expect(
      computeMapPixelSize(
        makeResolvedMap({
          orientation: 'isometric',
          width: 3,
          height: 2,
          tilewidth: 64,
          tileheight: 32
        })
      )
    ).toEqual({ width: 160, height: 80 })
  })

  it('computes x-staggered extents', () => {
    expect(
      computeMapPixelSize(
        makeResolvedMap({
          orientation: 'staggered',
          staggeraxis: 'x',
          width: 3,
          height: 2,
          tilewidth: 64,
          tileheight: 32
        })
      )
    ).toEqual({ width: 128, height: 80 })
  })
})

describe('getTileIterationPlan', () => {
  it('plans right-down by row then column', () => {
    expect(getTileIterationPlan(2, 2, { renderorder: 'right-down' })).toEqual({
      rowStart: 0,
      rowEnd: 2,
      rowStep: 1,
      colStart: 0,
      colEnd: 2,
      colStep: 1
    })
  })

  it('plans left-up from bottom-right to top-left', () => {
    expect(getTileIterationPlan(2, 2, { renderorder: 'left-up' })).toEqual({
      rowStart: 1,
      rowEnd: -1,
      rowStep: -1,
      colStart: 1,
      colEnd: -1,
      colStep: -1
    })
  })
})
