/**
 * @vitest-environment jsdom
 */
import { type Sprite, Texture } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { TiledMap } from '../../src/renderer/TiledMap.js'
import { TileLayerRenderer } from '../../src/renderer/TileLayerRenderer.js'
import { TileSetRenderer } from '../../src/renderer/TileSetRenderer.js'
import type {
  MapContext,
  ResolvedMap,
  ResolvedTileLayer,
  ResolvedTileset
} from '../../src/types/index.js'

function makeMap(layers: ResolvedMap['layers']): ResolvedMap {
  return {
    orientation: 'orthogonal',
    renderorder: 'right-down',
    width: 2,
    height: 2,
    tilewidth: 32,
    tileheight: 32,
    infinite: false,
    parallaxoriginx: 0,
    parallaxoriginy: 0,
    properties: [],
    tilesets: [],
    layers,
    version: '1.10'
  }
}

function makeTileLayer(overrides: Partial<ResolvedTileLayer>): ResolvedTileLayer {
  return {
    type: 'tilelayer',
    id: 1,
    name: 'layer',
    opacity: 1,
    visible: true,
    offsetx: 0,
    offsety: 0,
    parallaxx: 1,
    parallaxy: 1,
    properties: [],
    width: 1,
    height: 1,
    infinite: false,
    tiles: [],
    ...overrides
  }
}

function makeTileset(overrides?: Partial<ResolvedTileset>): ResolvedTileset {
  return {
    firstgid: 1,
    name: 'test',
    tilewidth: 32,
    tileheight: 32,
    columns: 1,
    tilecount: 1,
    margin: 0,
    spacing: 0,
    tileoffset: { x: 0, y: 0 },
    objectalignment: 'unspecified',
    tilerendersize: 'tile',
    fillmode: 'stretch',
    tiles: new Map(),
    properties: [],
    ...overrides
  }
}

describe('TiledMap layerFilter', () => {
  it('renders only layers accepted by the filter', () => {
    const ground = makeTileLayer({ id: 1, name: 'ground' })
    const overhead = makeTileLayer({
      id: 2,
      name: 'canopy',
      properties: [{ name: 'overhead', type: 'bool', value: true }]
    })

    const map = new TiledMap(makeMap([ground, overhead]), {
      layerFilter: (layer) =>
        layer.properties.some((prop) => prop.name === 'overhead' && prop.value === true)
    })

    expect(map.getLayer('ground')).toBeUndefined()
    expect(map.getLayer('canopy')).toBeDefined()
  })

  it('keeps a group when a descendant layer matches the filter', () => {
    const map = new TiledMap(
      makeMap([
        {
          type: 'group',
          id: 10,
          name: 'decor',
          opacity: 1,
          visible: true,
          offsetx: 0,
          offsety: 0,
          parallaxx: 1,
          parallaxy: 1,
          properties: [],
          layers: [
            makeTileLayer({ id: 11, name: 'below' }),
            makeTileLayer({
              id: 12,
              name: 'above',
              properties: [{ name: 'overhead', type: 'bool', value: true }]
            })
          ]
        }
      ]),
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
    const isOverhead = (layer: ResolvedMap['layers'][number]) =>
      layer.properties.some((prop) => prop.name === 'overhead' && prop.value === true)
    const map = new TiledMap(
      makeMap([
        {
          type: 'group',
          id: 10,
          name: 'decor',
          opacity: 1,
          visible: true,
          offsetx: 0,
          offsety: 0,
          parallaxx: 1,
          parallaxy: 1,
          properties: [],
          layers: [
            makeTileLayer({ id: 11, name: 'below' }),
            makeTileLayer({
              id: 12,
              name: 'above',
              properties: [{ name: 'overhead', type: 'bool', value: true }]
            })
          ]
        }
      ]),
      { layerFilter: (layer) => !isOverhead(layer) }
    )

    const group = map.getLayer('decor')

    expect(group).toBeDefined()
    expect(group?.children.map((child) => child.label)).toEqual(['below'])
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
    const renderer = new TileSetRenderer(makeTileset(), null)
    renderer.setTileTexture(0, Texture.EMPTY)

    const layer = new TileLayerRenderer(
      makeTileLayer({
        tiles: [
          {
            gid: 1,
            localId: 0,
            tilesetIndex: 0,
            horizontalFlip: false,
            verticalFlip: false,
            diagonalFlip: false
          }
        ]
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
    const renderer = new TileSetRenderer(makeTileset(), null)
    renderer.setTileTexture(0, Texture.EMPTY)

    const layer = new TileLayerRenderer(
      makeTileLayer({
        tiles: [
          {
            gid: 1,
            localId: 0,
            tilesetIndex: 0,
            horizontalFlip: false,
            verticalFlip: false,
            diagonalFlip: false
          }
        ]
      }),
      [renderer],
      ctx
    )

    const sprite = layer.children[0] as Sprite
    expect(sprite.width).toBe(32)
    expect(sprite.height).toBe(32)
  })
})
