/**
 * @vitest-environment jsdom
 */
import { type Mesh, Texture } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { TiledMap } from '../../src/renderer/TiledMap.js'
import { TileLayerRenderer } from '../../src/renderer/TileLayerRenderer.js'
import { TileSetRenderer } from '../../src/renderer/TileSetRenderer.js'
import {
  FLIPPED_DIAGONALLY_FLAG,
  FLIPPED_HORIZONTALLY_FLAG,
  FLIPPED_VERTICALLY_FLAG,
  type MapContext
} from '../../src/types/index.js'
import {
  makeResolvedChunk,
  makeResolvedGroupLayer,
  makeResolvedMap,
  makeResolvedTile,
  makeResolvedTileLayer,
  makeResolvedTileset,
  makeTileSetRenderer
} from '../helpers/resolved.js'

const ctx: MapContext = {
  orientation: 'orthogonal',
  renderorder: 'right-down',
  tilewidth: 32,
  tileheight: 32,
  tileSpritePadding: 0
}

describe('TileLayerRenderer runtime editing', () => {
  it('reads, sets, and clears finite layer tiles', () => {
    const layerData = makeResolvedTileLayer({
      width: 2,
      height: 2,
      tiles: [null, null, null, null]
    })
    const renderer = new TileLayerRenderer(layerData, [makeTileSetRenderer()], ctx)
    const tile = makeResolvedTile()

    expect(renderer.getTile(1, 0)).toBeNull()

    renderer.setTile(1, 0, tile)
    expect(renderer.getTile(1, 0)).toEqual(tile)
    expect(layerData.tiles[1]).toEqual(tile)

    renderer.clearTile(1, 0)
    expect(renderer.getTile(1, 0)).toBeNull()
    expect(layerData.tiles[1]).toBeNull()
  })

  it('edits chunked infinite layer tiles', () => {
    const layerData = makeResolvedTileLayer({
      infinite: true,
      chunks: [
        makeResolvedChunk({
          x: 10,
          y: 20,
          width: 2,
          height: 2,
          tiles: [null, null, null, null]
        })
      ]
    })
    const renderer = new TileLayerRenderer(layerData, [makeTileSetRenderer()], ctx)
    const tile = makeResolvedTile()

    renderer.setTile(11, 21, tile)

    expect(renderer.getTile(11, 21)).toEqual(tile)
    expect(layerData.chunks?.[0]?.tiles[3]).toEqual(tile)
  })

  it('updates packed mesh UVs in place for same-atlas tile edits', () => {
    const layerData = makeResolvedTileLayer({
      width: 1,
      height: 1,
      tiles: [makeResolvedTile({ gid: 1, localId: 0 })]
    })
    const tileset = new TileSetRenderer(
      makeResolvedTileset({ columns: 2, tilecount: 2 }),
      Texture.EMPTY
    )
    const renderer = new TileLayerRenderer(layerData, [tileset], ctx)
    const mesh = renderer.children[0] as Mesh
    const initialUvs = Array.from(mesh.geometry.uvs)

    renderer.setTile(0, 0, makeResolvedTile({ gid: 2, localId: 1 }))

    expect(renderer.children[0]).toBe(mesh)
    expect(Array.from(mesh.geometry.uvs)).not.toEqual(initialUvs)
    expect(renderer.getTile(0, 0)).toMatchObject({ gid: 2, localId: 1 })
  })

  it('updates chunked infinite packed mesh tiles in place', () => {
    const layerData = makeResolvedTileLayer({
      infinite: true,
      chunks: [
        makeResolvedChunk({
          x: 10,
          y: 20,
          width: 1,
          height: 1,
          tiles: [makeResolvedTile({ gid: 1, localId: 0 })]
        })
      ]
    })
    const tileset = new TileSetRenderer(
      makeResolvedTileset({ columns: 2, tilecount: 2 }),
      Texture.EMPTY
    )
    const renderer = new TileLayerRenderer(layerData, [tileset], ctx)
    const mesh = renderer.children[0] as Mesh
    const initialUvs = Array.from(mesh.geometry.uvs)

    renderer.setTile(10, 20, makeResolvedTile({ gid: 2, localId: 1 }))

    expect(renderer.children[0]).toBe(mesh)
    expect(Array.from(mesh.geometry.uvs)).not.toEqual(initialUvs)
    expect(renderer.getTile(10, 20)).toMatchObject({ gid: 2, localId: 1 })
    expect(layerData.chunks?.[0]?.tiles[0]).toMatchObject({ gid: 2, localId: 1 })
  })

  it('clears packed mesh tiles in place', () => {
    const layerData = makeResolvedTileLayer({
      width: 1,
      height: 1,
      tiles: [makeResolvedTile()]
    })
    const renderer = new TileLayerRenderer(layerData, [makeTileSetRenderer()], ctx)
    const mesh = renderer.children[0] as Mesh

    renderer.clearTile(0, 0)

    expect(renderer.children[0]).toBe(mesh)
    expect(Array.from(mesh.geometry.positions)).toEqual(new Array(8).fill(0))
    expect(renderer.getTile(0, 0)).toBeNull()
  })

  it('rebuilds when clearing a sprite-backed tile', () => {
    const layerData = makeResolvedTileLayer({
      width: 1,
      height: 1,
      tiles: [makeResolvedTile()]
    })
    const tileset = makeTileSetRenderer({
      tiles: new Map([
        [
          0,
          {
            id: 0,
            animation: [
              { tileid: 0, duration: 100 },
              { tileid: 0, duration: 100 }
            ]
          }
        ]
      ])
    })
    const renderer = new TileLayerRenderer(layerData, [tileset], ctx)

    renderer.clearTile(0, 0)

    expect(renderer.children).toHaveLength(0)
    expect(renderer.getTile(0, 0)).toBeNull()
  })

  it('rejects coordinates outside the layer', () => {
    const renderer = new TileLayerRenderer(
      makeResolvedTileLayer({ width: 1, height: 1, tiles: [null] }),
      [makeTileSetRenderer()],
      ctx
    )

    expect(() => renderer.setTile(2, 0, makeResolvedTile())).toThrow(RangeError)
  })

  it('returns null for reads outside the layer', () => {
    const renderer = new TileLayerRenderer(
      makeResolvedTileLayer({ width: 1, height: 1, tiles: [makeResolvedTile()] }),
      [makeTileSetRenderer()],
      ctx
    )

    expect(renderer.getTile(-1, 0)).toBeNull()
    expect(renderer.getTile(1, 0)).toBeNull()
  })
})

describe('TiledMap runtime editing', () => {
  it('sets tiles by layer name and local tileset tile ID', () => {
    const ground = makeResolvedTileLayer({
      id: 1,
      name: 'ground',
      width: 2,
      height: 1,
      tiles: [null, null]
    })
    const map = new TiledMap(
      makeResolvedMap({
        tilesets: [makeResolvedTileset({ name: 'dungeon', firstgid: 100, tilecount: 4 })],
        layers: [ground]
      })
    )

    map.setTile('ground', 1, 0, { tileset: 'dungeon', tileId: 2 })

    expect(map.getTile('ground', 1, 0)).toEqual({
      gid: 102,
      localId: 2,
      tilesetIndex: 0,
      horizontalFlip: false,
      verticalFlip: false,
      diagonalFlip: false
    })
    expect(ground.tiles[1]?.gid).toBe(102)
  })

  it('finds nested tile layers by id', () => {
    const below = makeResolvedTileLayer({
      id: 7,
      name: 'below',
      width: 1,
      height: 1,
      tiles: [null]
    })
    const map = new TiledMap(
      makeResolvedMap({
        tilesets: [makeResolvedTileset({ firstgid: 1, tilecount: 2 })],
        layers: [makeResolvedGroupLayer({ name: 'group', layers: [below] })]
      })
    )

    map.setTile(7, 0, 0, 1)

    expect(map.getTile(7, 0, 0)?.localId).toBe(0)
  })

  it('decodes raw GID flip flags and resolves the owning tileset', () => {
    const ground = makeResolvedTileLayer({
      name: 'ground',
      width: 1,
      height: 1,
      tiles: [null]
    })
    const map = new TiledMap(
      makeResolvedMap({
        tilesets: [
          makeResolvedTileset({ name: 'base', firstgid: 1, tilecount: 4 }),
          makeResolvedTileset({ name: 'decor', firstgid: 10, tilecount: 4 })
        ],
        layers: [ground]
      })
    )

    map.setTile(
      'ground',
      0,
      0,
      11 | FLIPPED_HORIZONTALLY_FLAG | FLIPPED_VERTICALLY_FLAG | FLIPPED_DIAGONALLY_FLAG
    )

    expect(map.getTile('ground', 0, 0)).toEqual({
      gid: 11,
      localId: 1,
      tilesetIndex: 1,
      horizontalFlip: true,
      verticalFlip: true,
      diagonalFlip: true
    })
  })

  it('defaults local tile refs to the first tileset when none is specified', () => {
    const ground = makeResolvedTileLayer({ name: 'ground', width: 1, height: 1, tiles: [null] })
    const map = new TiledMap(
      makeResolvedMap({
        tilesets: [makeResolvedTileset({ firstgid: 20, tilecount: 3 })],
        layers: [ground]
      })
    )

    map.setTile('ground', 0, 0, { localId: 2, horizontalFlip: true })

    expect(map.getTile('ground', 0, 0)).toMatchObject({
      gid: 22,
      localId: 2,
      tilesetIndex: 0,
      horizontalFlip: true
    })
  })

  it('clears tiles through TiledMap', () => {
    const ground = makeResolvedTileLayer({
      name: 'ground',
      width: 1,
      height: 1,
      tiles: [makeResolvedTile()]
    })
    const map = new TiledMap(makeResolvedMap({ layers: [ground] }))

    map.clearTile('ground', 0, 0)

    expect(map.getTile('ground', 0, 0)).toBeNull()
    expect(ground.tiles[0]).toBeNull()
  })

  it('rejects editing a filtered-out tile layer', () => {
    const hidden = makeResolvedTileLayer({ name: 'hidden', width: 1, height: 1, tiles: [null] })
    const map = new TiledMap(makeResolvedMap({ layers: [hidden] }), { layerFilter: () => false })

    expect(() => map.setTile('hidden', 0, 0, 1)).toThrow(/not rendered/)
  })

  it('rejects unknown tilesets and out-of-range local tile IDs', () => {
    const ground = makeResolvedTileLayer({ name: 'ground', width: 1, height: 1, tiles: [null] })
    const map = new TiledMap(
      makeResolvedMap({
        tilesets: [makeResolvedTileset({ name: 'base', firstgid: 1, tilecount: 2 })],
        layers: [ground]
      })
    )

    expect(() => map.setTile('ground', 0, 0, { tileset: 'missing', tileId: 0 })).toThrow(
      /Tileset "missing" not found/
    )
    expect(() => map.setTile('ground', 0, 0, { tileset: 'base', tileId: 2 })).toThrow(RangeError)
  })
})

describe('Issue #20 runtime map editing use cases', () => {
  it('updates a save-state chest tile from closed to open on an existing map', () => {
    const CLOSED_CHEST_TILE_ID = 4
    const OPEN_CHEST_TILE_ID = 5
    const chests = makeResolvedTileLayer({
      id: 3,
      name: 'chests',
      width: 4,
      height: 3,
      tiles: new Array(12).fill(null)
    })
    const map = new TiledMap(
      makeResolvedMap({
        tilesets: [makeResolvedTileset({ name: 'dungeon', firstgid: 100, tilecount: 16 })],
        layers: [chests]
      })
    )

    map.setTile('chests', 2, 1, { tileset: 'dungeon', tileId: CLOSED_CHEST_TILE_ID })
    expect(map.getTile('chests', 2, 1)).toMatchObject({
      gid: 104,
      localId: CLOSED_CHEST_TILE_ID
    })

    map.setTile('chests', 2, 1, { tileset: 'dungeon', tileId: OPEN_CHEST_TILE_ID })

    expect(map.getTile('chests', 2, 1)).toMatchObject({
      gid: 105,
      localId: OPEN_CHEST_TILE_ID
    })
    expect(chests.tiles[6]?.localId).toBe(OPEN_CHEST_TILE_ID)
  })

  it('supports editing a procedurally assembled dungeon map through the same TiledMap API', () => {
    const floor = makeResolvedTileLayer({
      id: 1,
      name: 'floor',
      width: 3,
      height: 3,
      tiles: [
        makeResolvedTile({ gid: 1, localId: 0 }),
        makeResolvedTile({ gid: 1, localId: 0 }),
        makeResolvedTile({ gid: 1, localId: 0 }),
        makeResolvedTile({ gid: 1, localId: 0 }),
        makeResolvedTile({ gid: 1, localId: 0 }),
        makeResolvedTile({ gid: 1, localId: 0 }),
        makeResolvedTile({ gid: 1, localId: 0 }),
        makeResolvedTile({ gid: 1, localId: 0 }),
        makeResolvedTile({ gid: 1, localId: 0 })
      ]
    })
    const details = makeResolvedTileLayer({
      id: 2,
      name: 'details',
      width: 3,
      height: 3,
      tiles: new Array(9).fill(null)
    })
    const map = new TiledMap(
      makeResolvedMap({
        width: 3,
        height: 3,
        tilesets: [makeResolvedTileset({ name: 'dungeon', firstgid: 1, tilecount: 8 })],
        layers: [floor, details]
      })
    )

    map.setTile('details', 1, 1, { tileset: 'dungeon', tileId: 7 })

    expect(map).toBeInstanceOf(TiledMap)
    expect(map.getLayer('floor')).toBeDefined()
    expect(map.getTile('floor', 1, 1)).toMatchObject({ gid: 1, localId: 0 })
    expect(map.getTile('details', 1, 1)).toMatchObject({ gid: 8, localId: 7 })
    expect(details.tiles[4]?.gid).toBe(8)
  })
})
