import { describe, expect, it } from 'vitest'
import { parseMap } from '../../src/parser/resolveMap.js'
import type { TiledMap } from '../../src/types/index.js'

function makeMinimalMap(overrides?: Partial<TiledMap>): TiledMap {
  return {
    type: 'map',
    version: '1.10',
    orientation: 'orthogonal',
    renderorder: 'right-down',
    width: 2,
    height: 2,
    tilewidth: 32,
    tileheight: 32,
    infinite: false,
    layers: [],
    tilesets: [],
    nextlayerid: 1,
    nextobjectid: 1,
    ...overrides
  }
}

describe('parseMap', () => {
  it('resolves a minimal empty map', () => {
    const map = makeMinimalMap()
    const result = parseMap(map)

    expect(result.orientation).toBe('orthogonal')
    expect(result.width).toBe(2)
    expect(result.height).toBe(2)
    expect(result.tilewidth).toBe(32)
    expect(result.tileheight).toBe(32)
    expect(result.layers).toEqual([])
    expect(result.tilesets).toEqual([])
    expect(result.renderorder).toBe('right-down')
    expect(result.infinite).toBe(false)
  })

  it('resolves a tile layer with embedded tileset', () => {
    const map = makeMinimalMap({
      tilesets: [
        {
          firstgid: 1,
          name: 'test',
          tilewidth: 32,
          tileheight: 32,
          columns: 4,
          tilecount: 16,
          margin: 0,
          spacing: 0,
          image: 'tiles.png',
          imagewidth: 128,
          imageheight: 128
        }
      ],
      layers: [
        {
          id: 1,
          name: 'ground',
          type: 'tilelayer',
          x: 0,
          y: 0,
          width: 2,
          height: 2,
          opacity: 1,
          visible: true,
          data: [1, 2, 3, 0]
        }
      ]
    })

    const result = parseMap(map)

    expect(result.tilesets).toHaveLength(1)
    expect(result.tilesets[0]!.name).toBe('test')
    expect(result.tilesets[0]!.firstgid).toBe(1)

    expect(result.layers).toHaveLength(1)
    const layer = result.layers[0]!
    expect(layer.type).toBe('tilelayer')

    if (layer.type === 'tilelayer') {
      expect(layer.tiles).toHaveLength(4)
      expect(layer.tiles[0]).not.toBeNull()
      expect(layer.tiles[0]!.gid).toBe(1)
      expect(layer.tiles[0]!.localId).toBe(0)
      expect(layer.tiles[1]!.gid).toBe(2)
      expect(layer.tiles[1]!.localId).toBe(1)
      expect(layer.tiles[2]!.gid).toBe(3)
      expect(layer.tiles[2]!.localId).toBe(2)
      expect(layer.tiles[3]).toBeNull()
    }
  })

  it('resolves an object layer', () => {
    const map = makeMinimalMap({
      layers: [
        {
          id: 1,
          name: 'objects',
          type: 'objectgroup',
          x: 0,
          y: 0,
          opacity: 1,
          visible: true,
          objects: [
            {
              id: 1,
              name: 'spawn',
              type: 'point',
              x: 100,
              y: 200,
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

    const result = parseMap(map)
    expect(result.layers).toHaveLength(1)
    const layer = result.layers[0]!
    expect(layer.type).toBe('objectgroup')

    if (layer.type === 'objectgroup') {
      expect(layer.objects).toHaveLength(1)
      expect(layer.objects[0]!.name).toBe('spawn')
      expect(layer.objects[0]!.point).toBe(true)
    }
  })

  it('resolves an image layer', () => {
    const map = makeMinimalMap({
      layers: [
        {
          id: 1,
          name: 'bg',
          type: 'imagelayer',
          x: 0,
          y: 0,
          opacity: 0.5,
          visible: true,
          image: 'background.png'
        }
      ]
    })

    const result = parseMap(map)
    expect(result.layers).toHaveLength(1)
    const layer = result.layers[0]!
    expect(layer.type).toBe('imagelayer')

    if (layer.type === 'imagelayer') {
      expect(layer.image).toBe('background.png')
      expect(layer.opacity).toBe(0.5)
      expect(layer.repeatx).toBe(false)
      expect(layer.repeaty).toBe(false)
    }
  })

  it('resolves a group layer with nested children', () => {
    const map = makeMinimalMap({
      layers: [
        {
          id: 1,
          name: 'group1',
          type: 'group',
          x: 0,
          y: 0,
          opacity: 1,
          visible: true,
          layers: [
            {
              id: 2,
              name: 'nested-img',
              type: 'imagelayer',
              x: 0,
              y: 0,
              opacity: 1,
              visible: true,
              image: 'nested.png'
            }
          ]
        }
      ]
    })

    const result = parseMap(map)
    expect(result.layers).toHaveLength(1)
    const group = result.layers[0]!
    expect(group.type).toBe('group')

    if (group.type === 'group') {
      expect(group.layers).toHaveLength(1)
      expect(group.layers[0]!.type).toBe('imagelayer')
      expect(group.layers[0]!.name).toBe('nested-img')
    }
  })

  it('defaults parallax, offset, and render order', () => {
    const map = makeMinimalMap({
      renderorder: undefined,
      parallaxoriginx: undefined,
      parallaxoriginy: undefined,
      layers: [
        {
          id: 1,
          name: 'layer',
          type: 'tilelayer',
          x: 0,
          y: 0,
          width: 2,
          height: 2,
          opacity: 1,
          visible: true,
          data: [0, 0, 0, 0]
        }
      ]
    })

    const result = parseMap(map)
    expect(result.renderorder).toBe('right-down')
    expect(result.parallaxoriginx).toBe(0)
    expect(result.parallaxoriginy).toBe(0)

    const layer = result.layers[0]!
    if (layer.type === 'tilelayer') {
      expect(layer.offsetx).toBe(0)
      expect(layer.offsety).toBe(0)
      expect(layer.parallaxx).toBe(1)
      expect(layer.parallaxy).toBe(1)
    }
  })

  it('throws for unresolved external tileset', () => {
    const map = makeMinimalMap({
      tilesets: [{ firstgid: 1, source: 'external.tsj' }]
    })

    expect(() => parseMap(map)).toThrow('External tileset')
  })

  it('resolves external tileset when provided via options', () => {
    const map = makeMinimalMap({
      tilesets: [{ firstgid: 1, source: 'external.tsj' }],
      layers: [
        {
          id: 1,
          name: 'ground',
          type: 'tilelayer',
          x: 0,
          y: 0,
          width: 2,
          height: 2,
          opacity: 1,
          visible: true,
          data: [1, 0, 0, 0]
        }
      ]
    })

    const externalTilesets = new Map()
    externalTilesets.set('external.tsj', {
      firstgid: 1,
      name: 'ext',
      tilewidth: 32,
      tileheight: 32,
      columns: 4,
      tilecount: 16,
      margin: 0,
      spacing: 0,
      image: 'ext.png',
      imagewidth: 128,
      imageheight: 128
    })

    const result = parseMap(map, { externalTilesets })
    expect(result.tilesets).toHaveLength(1)
    expect(result.tilesets[0]!.name).toBe('ext')

    const layer = result.layers[0]!
    if (layer.type === 'tilelayer') {
      expect(layer.tiles[0]!.gid).toBe(1)
      expect(layer.tiles[0]!.localId).toBe(0)
    }
  })

  it('resolves an infinite map with chunks', () => {
    const map = makeMinimalMap({
      infinite: true,
      tilesets: [
        {
          firstgid: 1,
          name: 'test',
          tilewidth: 32,
          tileheight: 32,
          columns: 4,
          tilecount: 16,
          margin: 0,
          spacing: 0,
          image: 'tiles.png',
          imagewidth: 128,
          imageheight: 128
        }
      ],
      layers: [
        {
          id: 1,
          name: 'ground',
          type: 'tilelayer',
          x: 0,
          y: 0,
          width: 2,
          height: 2,
          opacity: 1,
          visible: true,
          chunks: [
            { x: 0, y: 0, width: 2, height: 2, data: [1, 2, 3, 0] },
            { x: 2, y: 0, width: 2, height: 2, data: [4, 5, 0, 6] }
          ]
        }
      ]
    })

    const result = parseMap(map)
    const layer = result.layers[0]!
    expect(layer.type).toBe('tilelayer')

    if (layer.type === 'tilelayer') {
      expect(layer.infinite).toBe(true)
      expect(layer.tiles).toEqual([])
      expect(layer.chunks).toHaveLength(2)

      const chunk0 = layer.chunks![0]!
      expect(chunk0.x).toBe(0)
      expect(chunk0.y).toBe(0)
      expect(chunk0.width).toBe(2)
      expect(chunk0.tiles).toHaveLength(4)
      expect(chunk0.tiles[0]!.gid).toBe(1)
      expect(chunk0.tiles[3]).toBeNull()

      const chunk1 = layer.chunks![1]!
      expect(chunk1.x).toBe(2)
      expect(chunk1.tiles[0]!.gid).toBe(4)
      expect(chunk1.tiles[2]).toBeNull()
      expect(chunk1.tiles[3]!.gid).toBe(6)
    }
  })
})
