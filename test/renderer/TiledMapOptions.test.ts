/**
 * @vitest-environment jsdom
 */
import { type Sprite, Texture } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { TiledMap } from '../../src/renderer/TiledMap.js'
import { TileLayerRenderer } from '../../src/renderer/TileLayerRenderer.js'
import { TileSetRenderer } from '../../src/renderer/TileSetRenderer.js'
import type { MapContext } from '../../src/types/index.js'
import {
  makeResolvedGroupLayer,
  makeResolvedMap,
  makeResolvedTile,
  makeResolvedTileLayer,
  makeResolvedTileset
} from '../helpers/resolved.js'

describe('TiledMap layerFilter', () => {
  it('renders only layers accepted by the filter', () => {
    const ground = makeResolvedTileLayer({ id: 1, name: 'ground' })
    const overhead = makeResolvedTileLayer({
      id: 2,
      name: 'canopy',
      properties: [{ name: 'overhead', type: 'bool', value: true }]
    })

    const map = new TiledMap(makeResolvedMap({ layers: [ground, overhead] }), {
      layerFilter: (layer) =>
        layer.properties.some((prop) => prop.name === 'overhead' && prop.value === true)
    })

    expect(map.getLayer('ground')).toBeUndefined()
    expect(map.getLayer('canopy')).toBeDefined()
  })

  it('keeps a group when a descendant layer matches the filter', () => {
    const map = new TiledMap(
      makeResolvedMap({
        layers: [
          makeResolvedGroupLayer({
            id: 10,
            name: 'decor',
            layers: [
              makeResolvedTileLayer({ id: 11, name: 'below' }),
              makeResolvedTileLayer({
                id: 12,
                name: 'above',
                properties: [{ name: 'overhead', type: 'bool', value: true }]
              })
            ]
          })
        ]
      }),
      {
        layerFilter: (layer) =>
          layer.properties.some((prop) => prop.name === 'overhead' && prop.value === true)
      }
    )

    const group = map.getLayer('decor')

    expect(group).toBeDefined()
    expect(group?.children.map((child) => child.label)).toEqual(['above'])
  })

  it('filters group descendants independently', () => {
    const isOverhead = (layer: ReturnType<typeof makeResolvedMap>['layers'][number]) =>
      layer.properties.some((prop) => prop.name === 'overhead' && prop.value === true)
    const map = new TiledMap(
      makeResolvedMap({
        layers: [
          makeResolvedGroupLayer({
            id: 10,
            name: 'decor',
            layers: [
              makeResolvedTileLayer({ id: 11, name: 'below' }),
              makeResolvedTileLayer({
                id: 12,
                name: 'above',
                properties: [{ name: 'overhead', type: 'bool', value: true }]
              })
            ]
          })
        ]
      }),
      { layerFilter: (layer) => !isOverhead(layer) }
    )

    const group = map.getLayer('decor')

    expect(group).toBeDefined()
    expect(group?.children.map((child) => child.label)).toEqual(['below'])
  })

  it('finds nested rendered layers by name', () => {
    const map = new TiledMap(
      makeResolvedMap({
        layers: [
          makeResolvedGroupLayer({
            id: 10,
            name: 'decor',
            layers: [makeResolvedTileLayer({ id: 11, name: 'below' })]
          })
        ]
      })
    )

    expect(map.getLayer('below')?.label).toBe('below')
  })
})

describe('tileSpritePadding', () => {
  it('adds a small default overlap to full-size orthogonal tile sprites', () => {
    const ctx: MapContext = {
      orientation: 'orthogonal',
      renderorder: 'right-down',
      tilewidth: 32,
      tileheight: 32,
      tileSpritePadding: 0.01
    }
    const renderer = new TileSetRenderer(makeResolvedTileset(), null)
    renderer.setTileTexture(0, Texture.EMPTY)

    const layer = new TileLayerRenderer(
      makeResolvedTileLayer({
        tiles: [makeResolvedTile()]
      }),
      [renderer],
      ctx
    )

    const sprite = layer.children[0] as Sprite
    expect(sprite.width).toBeCloseTo(32.01)
    expect(sprite.height).toBeCloseTo(32.01)
  })

  it('can disable tile sprite overlap', () => {
    const ctx: MapContext = {
      orientation: 'orthogonal',
      renderorder: 'right-down',
      tilewidth: 32,
      tileheight: 32,
      tileSpritePadding: 0
    }
    const renderer = new TileSetRenderer(makeResolvedTileset(), null)
    renderer.setTileTexture(0, Texture.EMPTY)

    const layer = new TileLayerRenderer(
      makeResolvedTileLayer({
        tiles: [makeResolvedTile()]
      }),
      [renderer],
      ctx
    )

    const sprite = layer.children[0] as Sprite
    expect(sprite.width).toBe(32)
    expect(sprite.height).toBe(32)
  })
})
