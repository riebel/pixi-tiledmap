/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import { TiledMap } from '../../src/renderer/TiledMap.js'
import {
  makeResolvedGroupLayer,
  makeResolvedImageLayer,
  makeResolvedMap,
  makeResolvedObjectLayer,
  makeResolvedTileLayer
} from '../helpers/resolved.js'

describe('layer render groups', () => {
  it('makes tile and object layers render groups, but not image or group layers', () => {
    const map = new TiledMap(
      makeResolvedMap({
        layers: [
          makeResolvedTileLayer({ id: 1, name: 'ground' }),
          makeResolvedObjectLayer({ id: 2, name: 'objects' }),
          makeResolvedImageLayer({ id: 3, name: 'sky' }),
          makeResolvedGroupLayer({
            id: 4,
            name: 'decor',
            layers: [makeResolvedTileLayer({ id: 5, name: 'nested' })]
          })
        ]
      })
    )

    expect(map.isRenderGroup).toBe(false)
    expect(map.getLayer('ground')?.isRenderGroup).toBe(true)
    expect(map.getLayer('objects')?.isRenderGroup).toBe(true)
    expect(map.getLayer('sky')?.isRenderGroup).toBe(false)
    expect(map.getLayer('decor')?.isRenderGroup).toBe(false)
    expect(map.getLayer('decor')?.children[0]?.isRenderGroup).toBe(true)
  })

  // PixiJS does not apply a render group's blend mode to what the group draws.
  it('keeps layers that blend, or sit in a group that blends, ordinary containers', () => {
    const map = new TiledMap(
      makeResolvedMap({
        layers: [
          makeResolvedTileLayer({ id: 1, name: 'shade', mode: 'multiply' }),
          makeResolvedObjectLayer({ id: 2, name: 'glow', mode: 'add' }),
          makeResolvedGroupLayer({
            id: 3,
            name: 'tinted',
            mode: 'screen',
            layers: [
              makeResolvedGroupLayer({
                id: 4,
                name: 'inner',
                layers: [makeResolvedTileLayer({ id: 5, name: 'deep' })]
              })
            ]
          }),
          makeResolvedTileLayer({ id: 6, name: 'plain', mode: 'normal' })
        ]
      })
    )

    expect(map.getLayer('shade')?.isRenderGroup).toBe(false)
    expect(map.getLayer('glow')?.isRenderGroup).toBe(false)
    expect(map.getLayer('tinted')?.children[0]?.children[0]?.isRenderGroup).toBe(false)
    expect(map.getLayer('plain')?.isRenderGroup).toBe(true)
  })
})
