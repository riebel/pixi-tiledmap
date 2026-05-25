/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import {
  createGroupLayer,
  createMap,
  createTileLayer,
  createTileset,
  TiledMap
} from '../src/index.js'

describe('procedural map creation', () => {
  it('creates a resolved map from tilesets and tile-layer data', () => {
    const mapData = createMap({
      width: 3,
      height: 2,
      tilewidth: 16,
      tileheight: 16,
      tilesets: [{ name: 'dungeon', firstgid: 10, tilewidth: 16, tileheight: 16, tilecount: 8 }],
      layers: [
        {
          name: 'floor',
          tiles: [
            { tileset: 'dungeon', tileId: 0 },
            { tileset: 'dungeon', tileId: 1 },
            null,
            12,
            0,
            { tileset: 'dungeon', localId: 5 }
          ]
        }
      ]
    })

    expect(mapData.width).toBe(3)
    expect(mapData.height).toBe(2)
    expect(mapData.tilesets[0]?.name).toBe('dungeon')
    expect(mapData.layers[0]?.type).toBe('tilelayer')

    const layer = mapData.layers[0]
    if (layer?.type === 'tilelayer') {
      expect(layer.tiles.map((tile) => tile?.gid ?? 0)).toEqual([10, 11, 0, 12, 0, 15])
      expect(layer.width).toBe(3)
      expect(layer.height).toBe(2)
    }
  })

  it('creates generated maps that render and edit through TiledMap', () => {
    const mapData = createMap({
      width: 2,
      height: 2,
      tilewidth: 32,
      tileheight: 32,
      tilesets: [{ name: 'dungeon', tilewidth: 32, tileheight: 32, tilecount: 4 }],
      layers: [{ name: 'ground', tiles: [1, 1, 1, 1] }]
    })
    const map = new TiledMap(mapData)

    map.setTile('ground', 1, 1, { tileset: 'dungeon', tileId: 3 })

    expect(map).toBeInstanceOf(TiledMap)
    expect(map.getTile('ground', 1, 1)).toMatchObject({ gid: 4, localId: 3 })
  })

  it('creates nested group layers with sequential ids', () => {
    const mapData = createMap({
      width: 1,
      height: 1,
      tilewidth: 16,
      tileheight: 16,
      layers: [
        {
          type: 'group',
          name: 'dungeon',
          layers: [{ name: 'floor', tiles: [null] }]
        }
      ]
    })

    const group = mapData.layers[0]
    expect(group?.type).toBe('group')
    if (group?.type === 'group') {
      expect(group.id).toBe(1)
      expect(group.layers[0]?.id).toBe(2)
      expect(group.layers[0]?.name).toBe('floor')
    }
  })

  it('supports standalone tileset and layer helpers', () => {
    const tileset = createTileset({
      name: 'decor',
      firstgid: 100,
      tilewidth: 16,
      tileheight: 16,
      image: 'decor.png',
      imagewidth: 64,
      tilecount: 8
    })
    const layer = createTileLayer(
      {
        name: 'decor',
        width: 2,
        height: 1,
        tiles: [
          { tileset: 'decor', tileId: 0 },
          { tileset: 'decor.png', tileId: 1 }
        ]
      },
      [tileset]
    )

    expect(tileset.columns).toBe(4)
    expect(layer.tiles.map((tile) => tile?.gid)).toEqual([100, 101])
  })

  it('creates chunked infinite tile layers', () => {
    const layer = createTileLayer(
      {
        name: 'rooms',
        chunks: [
          {
            x: 10,
            y: 20,
            width: 2,
            height: 1,
            tiles: [1, null]
          }
        ]
      },
      [createTileset({ name: 'dungeon', tilewidth: 16, tileheight: 16, tilecount: 2 })]
    )

    expect(layer.infinite).toBe(true)
    expect(layer.chunks?.[0]?.x).toBe(10)
    expect(layer.chunks?.[0]?.tiles[0]?.gid).toBe(1)
    expect(layer.chunks?.[0]?.tiles[1]).toBeNull()
  })

  it('rejects generated tile layers with the wrong tile count', () => {
    expect(() =>
      createTileLayer({
        name: 'bad',
        width: 2,
        height: 2,
        tiles: [null]
      })
    ).toThrow(/expected 4 tiles/)
  })

  it('creates standalone group layers', () => {
    const group = createGroupLayer({
      id: 10,
      name: 'group',
      layers: [{ name: 'child', width: 1, height: 1, tiles: [null] }]
    })

    expect(group.id).toBe(10)
    expect(group.layers[0]?.id).toBe(11)
  })

  it('creates image and object layers inside generated maps', () => {
    const mapData = createMap({
      width: 4,
      height: 4,
      tilewidth: 16,
      tileheight: 16,
      layers: [
        { type: 'imagelayer', name: 'sky', image: 'sky.png', repeatx: true },
        {
          type: 'objectgroup',
          name: 'objects',
          objects: [
            {
              id: 1,
              name: 'spawn',
              type: 'point',
              x: 16,
              y: 32,
              width: 0,
              height: 0,
              rotation: 0,
              visible: true,
              point: true
            }
          ]
        }
      ]
    })

    expect(mapData.layers[0]?.type).toBe('imagelayer')
    expect(mapData.layers[1]?.type).toBe('objectgroup')
    if (mapData.layers[0]?.type === 'imagelayer') {
      expect(mapData.layers[0].repeatx).toBe(true)
    }
    if (mapData.layers[1]?.type === 'objectgroup') {
      expect(mapData.layers[1].objects[0]?.name).toBe('spawn')
    }
  })
})
