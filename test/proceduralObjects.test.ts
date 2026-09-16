import { describe, expect, it } from 'vitest'
import type { CreateTilesetOptions, ResolvedObject } from '../src/index.js'
import { createMap, createObjectLayer, createTileset } from '../src/index.js'
import type { ResolvedObjectLayer } from '../src/types/index.js'

const ground: CreateTilesetOptions = {
  name: 'ground',
  tilewidth: 16,
  tileheight: 16,
  columns: 4,
  tilecount: 8,
  image: 'ground.png',
  imagewidth: 64,
  imageheight: 32
}

const objects: CreateTilesetOptions = {
  name: 'objects',
  tilewidth: 16,
  tileheight: 16,
  tilecount: 4,
  tiles: [{ id: 2, image: 'koopa.png', imagewidth: 16, imageheight: 32 }]
}

function objectLayerOf(map: ReturnType<typeof createMap>): ResolvedObjectLayer {
  const layer = map.layers[0]
  if (layer?.type !== 'objectgroup') throw new Error('expected an object layer')
  return layer
}

describe('createObjectLayer tile input', () => {
  it('resolves a tileset name and local tile id into a gid and tileset index', () => {
    const tilesets = [
      createTileset({ ...ground, firstgid: 1 }),
      createTileset({ ...objects, firstgid: 9 })
    ]

    const layer = createObjectLayer(
      {
        type: 'objectgroup',
        name: 'actors',
        objects: [{ id: 1, name: 'koopa', x: 32, y: 48, tile: { tileset: 'objects', tileId: 2 } }]
      },
      tilesets
    )

    expect(layer.objects[0]!.tile).toEqual({
      gid: 11,
      localId: 2,
      tilesetIndex: 1,
      horizontalFlip: false,
      verticalFlip: false,
      diagonalFlip: false
    })
  })

  it('produces the same object a hand-built ResolvedTile does', () => {
    const tilesets = [
      createTileset({ ...ground, firstgid: 1 }),
      createTileset({ ...objects, firstgid: 9 })
    ]
    const common = { id: 1, name: 'koopa', x: 32, y: 48, width: 16, height: 32 }

    const fromRef = createObjectLayer(
      {
        type: 'objectgroup',
        name: 'actors',
        objects: [{ ...common, tile: { tileset: 'objects', tileId: 2 } }]
      },
      tilesets
    )
    const fromResolved = createObjectLayer(
      {
        type: 'objectgroup',
        name: 'actors',
        objects: [
          {
            ...common,
            tile: {
              gid: 11,
              localId: 2,
              tilesetIndex: 1,
              horizontalFlip: false,
              verticalFlip: false,
              diagonalFlip: false
            }
          }
        ]
      },
      tilesets
    )

    expect(fromRef.objects).toEqual(fromResolved.objects)
  })

  it('derives the tileset index, so reordering tilesets does not change what a name resolves to', () => {
    const object = { id: 1, name: 'koopa', x: 0, y: 0, tile: { tileset: 'objects', tileId: 2 } }

    const original = createMap({
      width: 4,
      height: 4,
      tilewidth: 16,
      tileheight: 16,
      tilesets: [ground, objects],
      layers: [{ type: 'objectgroup', name: 'actors', objects: [object] }]
    })
    const reordered = createMap({
      width: 4,
      height: 4,
      tilewidth: 16,
      tileheight: 16,
      tilesets: [objects, ground],
      layers: [{ type: 'objectgroup', name: 'actors', objects: [object] }]
    })

    const fromOriginal = objectLayerOf(original).objects[0]!.tile!
    const fromReordered = objectLayerOf(reordered).objects[0]!.tile!

    // The tileset moved to index 0 and its firstgid changed with it, but both
    // still point at local tile 2 of "objects".
    expect(fromOriginal).toMatchObject({ tilesetIndex: 1, localId: 2, gid: 11 })
    expect(fromReordered).toMatchObject({ tilesetIndex: 0, localId: 2, gid: 3 })

    expect(original.tilesets[fromOriginal.tilesetIndex]!.name).toBe('objects')
    expect(reordered.tilesets[fromReordered.tilesetIndex]!.name).toBe('objects')
  })

  it('accepts a raw gid', () => {
    const tilesets = [
      createTileset({ ...ground, firstgid: 1 }),
      createTileset({ ...objects, firstgid: 9 })
    ]

    const layer = createObjectLayer(
      { type: 'objectgroup', name: 'actors', objects: [{ id: 1, name: '', tile: 11 }] },
      tilesets
    )

    expect(layer.objects[0]!.tile).toMatchObject({ gid: 11, localId: 2, tilesetIndex: 1 })
  })

  it('carries flip flags through a tile ref', () => {
    const tilesets = [createTileset({ ...objects, firstgid: 1 })]

    const layer = createObjectLayer(
      {
        type: 'objectgroup',
        name: 'actors',
        objects: [
          { id: 1, name: '', tile: { tileset: 'objects', tileId: 2, horizontalFlip: true } }
        ]
      },
      tilesets
    )

    expect(layer.objects[0]!.tile).toMatchObject({ horizontalFlip: true, verticalFlip: false })
  })

  it('still accepts fully resolved objects, which is what callers passed before', () => {
    const existing: ResolvedObject = {
      id: 3,
      name: 'zone',
      type: 'trigger',
      x: 1,
      y: 2,
      width: 16,
      height: 16,
      rotation: 0,
      visible: true,
      ellipse: true
    }

    const layer = createObjectLayer({ type: 'objectgroup', name: 'zones', objects: [existing] })
    expect(layer.objects[0]).toEqual(existing)
  })

  it('accepts a hand-built tile with no tilesets argument, as callers wrote before', () => {
    const tile = {
      gid: 11,
      localId: 2,
      tilesetIndex: 1,
      horizontalFlip: false,
      verticalFlip: false,
      diagonalFlip: false
    }

    // Callers may omit the tilesets and pass resolved objects straight
    // through, so re-resolving this GID against an empty tileset list would
    // throw on valid input.
    const layer = createObjectLayer({
      type: 'objectgroup',
      name: 'actors',
      objects: [{ id: 1, name: 'koopa', tile }]
    })

    expect(layer.objects[0]!.tile).toEqual(tile)
  })

  it('defaults object fields the caller omits', () => {
    const layer = createObjectLayer({
      type: 'objectgroup',
      name: 'zones',
      objects: [{ name: 'z' }]
    })

    expect(layer.objects[0]).toMatchObject({
      id: 0,
      name: 'z',
      type: '',
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      rotation: 0,
      visible: true
    })
  })

  it('leaves tile unset for a non-tile object', () => {
    const layer = createObjectLayer({
      type: 'objectgroup',
      name: 'zones',
      objects: [{ name: 'z' }]
    })
    expect(layer.objects[0]!.tile).toBeUndefined()
  })

  it('reports an unknown tileset name rather than guessing an index', () => {
    const tilesets = [createTileset({ ...ground, firstgid: 1 })]

    expect(() =>
      createObjectLayer(
        {
          type: 'objectgroup',
          name: 'actors',
          objects: [{ name: '', tile: { tileset: 'nope', tileId: 0 } }]
        },
        tilesets
      )
    ).toThrow(/nope/)
  })
})
