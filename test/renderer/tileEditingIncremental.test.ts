/**
 * @vitest-environment jsdom
 *
 * Structural regression tests for incremental tile editing. These
 * assert renderer bookkeeping (rebuilds, slot reuse, capacity growth, buffer
 * uploads) through the internal stats seam rather than wall-clock timing, so
 * they stay deterministic on CI.
 */
import { Container, type Mesh, Sprite, Texture, TextureSource } from 'pixi.js'
import { describe, expect, it, vi } from 'vitest'
import { readPackedTileStats } from '../../src/renderer/packedTileStats.js'
import { TiledMap } from '../../src/renderer/TiledMap.js'
import { TileLayerRenderer } from '../../src/renderer/TileLayerRenderer.js'
import { TileSetRenderer } from '../../src/renderer/TileSetRenderer.js'
import type { MapContext, ResolvedTile } from '../../src/types/index.js'
import {
  makeResolvedChunk,
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

function emptyLayer(width: number, height: number) {
  return makeResolvedTileLayer({
    width,
    height,
    tiles: new Array(width * height).fill(null)
  })
}

function filledLayer(width: number, height: number) {
  return makeResolvedTileLayer({
    width,
    height,
    tiles: Array.from({ length: width * height }, () => makeResolvedTile())
  })
}

/** Two-tile atlas so UV changes are observable. */
function atlasTileset() {
  return new TileSetRenderer(makeResolvedTileset({ columns: 2, tilecount: 4 }), Texture.EMPTY)
}

function meshes(renderer: TileLayerRenderer): Mesh[] {
  return renderer.children.filter((child) => 'geometry' in child) as Mesh[]
}

/** Reads the packed quad a handle-backed cell occupies, in slot order. */
function quadAt(mesh: Mesh, slot: number): number[] {
  return Array.from(mesh.geometry.positions.slice(slot * 8, slot * 8 + 8))
}

describe('incremental insert into empty cells', () => {
  it('inserts a packed tile into an empty cell without rebuilding the layer', () => {
    const layerData = emptyLayer(4, 4)
    const renderer = new TileLayerRenderer(layerData, [makeTileSetRenderer()], ctx)
    const stats = readPackedTileStats(renderer)

    renderer.setTile(1, 1, makeResolvedTile())

    expect(stats.fullRebuilds).toBe(0)
    expect(renderer.getTile(1, 1)).toMatchObject({ gid: 1 })
    expect(layerData.tiles[5]).toMatchObject({ gid: 1 })
    expect(quadAt(meshes(renderer)[0]!, 0)).toEqual([32, 32, 64, 32, 64, 64, 32, 64])
  })

  it('does not rebuild once per insert across many inserts', () => {
    const renderer = new TileLayerRenderer(emptyLayer(32, 32), [makeTileSetRenderer()], ctx)
    const stats = readPackedTileStats(renderer)

    for (let i = 0; i < 100; i++) {
      renderer.setTile(i % 32, Math.floor(i / 32), makeResolvedTile())
    }

    expect(stats.fullRebuilds).toBe(0)
    expect(stats.insertsIntoNewSlot).toBe(100)
    expect(meshes(renderer)).toHaveLength(1)
  })

  it('grows capacity geometrically rather than once per insert', () => {
    const renderer = new TileLayerRenderer(emptyLayer(64, 64), [makeTileSetRenderer()], ctx)
    const stats = readPackedTileStats(renderer)

    for (let i = 0; i < 1000; i++) {
      renderer.setTile(i % 64, Math.floor(i / 64), makeResolvedTile())
    }

    expect(stats.fullRebuilds).toBe(0)
    // Doubling from an empty layer: far fewer growths than inserts.
    expect(stats.capacityGrowths).toBeLessThan(20)
    expect(stats.capacityGrowths).toBeGreaterThan(0)
  })

  it('inserts into an empty cell of an already populated layer', () => {
    const layerData = makeResolvedTileLayer({
      width: 2,
      height: 1,
      tiles: [makeResolvedTile(), null]
    })
    const renderer = new TileLayerRenderer(layerData, [makeTileSetRenderer()], ctx)
    const stats = readPackedTileStats(renderer)
    const mesh = meshes(renderer)[0]!

    renderer.setTile(1, 0, makeResolvedTile())

    expect(stats.fullRebuilds).toBe(0)
    expect(meshes(renderer)[0]).toBe(mesh)
    expect(quadAt(mesh, 1)).toEqual([32, 0, 64, 0, 64, 32, 32, 32])
  })
})

describe('default seam padding', () => {
  // TiledMap defaults tileSpritePadding to 0.01, and `x + (size + padding)`
  // does not always round to the same double as `x + size + padding`. Without
  // slack the fast path would silently disappear for real maps.
  it.each([
    [32, 32],
    [16, 16],
    [24, 24],
    [33, 17]
  ])('inserts incrementally with padded %ix%i tiles', (tilewidth, tileheight) => {
    const paddedCtx: MapContext = { ...ctx, tilewidth, tileheight, tileSpritePadding: 0.01 }
    const tileset = new TileSetRenderer(
      makeResolvedTileset({ tilewidth, tileheight, columns: 1, tilecount: 1 }),
      Texture.EMPTY
    )
    const renderer = new TileLayerRenderer(emptyLayer(4, 4), [tileset], paddedCtx)

    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        renderer.setTile(col, row, makeResolvedTile())
      }
    }

    expect(readPackedTileStats(renderer).fullRebuilds).toBe(0)
    expect(renderer.getTile(3, 3)).toMatchObject({ gid: 1 })
  })

  it('inserts incrementally through TiledMap defaults', () => {
    const ground = makeResolvedTileLayer({
      name: 'ground',
      width: 4,
      height: 4,
      tiles: new Array(16).fill(null)
    })
    const map = new TiledMap(
      makeResolvedMap({
        width: 4,
        height: 4,
        tilesets: [
          makeResolvedTileset({
            name: 'base',
            image: 'base.png',
            firstgid: 1,
            columns: 2,
            tilecount: 4
          })
        ],
        layers: [ground]
      }),
      { tilesetTextures: new Map([['base.png', Texture.EMPTY]]) }
    )
    const layer = map.getLayer('ground') as TileLayerRenderer

    map.setTile('ground', 1, 1, 1)
    map.setTile('ground', 2, 1, 1)

    expect(readPackedTileStats(layer).fullRebuilds).toBe(0)
    expect(readPackedTileStats(layer).insertsIntoNewSlot).toBe(2)
  })
})

describe('slot reuse', () => {
  it('reuses the slot released by a clear on the same cell', () => {
    const renderer = new TileLayerRenderer(filledLayer(2, 2), [makeTileSetRenderer()], ctx)
    const stats = readPackedTileStats(renderer)

    renderer.clearTile(0, 0)
    renderer.setTile(0, 0, makeResolvedTile())

    expect(stats.fullRebuilds).toBe(0)
    expect(stats.insertsIntoFreeSlot).toBe(1)
    expect(stats.insertsIntoNewSlot).toBe(0)
    expect(stats.capacityGrowths).toBe(0)
  })

  it('reuses a released slot for a different cell', () => {
    const renderer = new TileLayerRenderer(filledLayer(2, 2), [makeTileSetRenderer()], ctx)
    const stats = readPackedTileStats(renderer)

    renderer.clearTile(0, 0)
    renderer.clearTile(1, 1)
    renderer.setTile(0, 0, makeResolvedTile())
    renderer.setTile(1, 1, makeResolvedTile())

    expect(stats.insertsIntoFreeSlot).toBe(2)
    expect(stats.capacityGrowths).toBe(0)
    expect(stats.fullRebuilds).toBe(0)
  })

  it('keeps mesh count and capacity stable across repeated clear/set cycles', () => {
    const renderer = new TileLayerRenderer(filledLayer(4, 4), [makeTileSetRenderer()], ctx)
    const stats = readPackedTileStats(renderer)
    const meshCountBefore = meshes(renderer).length
    const capacityBefore = meshes(renderer)[0]!.geometry.positions.length

    for (let i = 0; i < 500; i++) {
      renderer.clearTile(2, 2)
      renderer.setTile(2, 2, makeResolvedTile())
    }

    expect(stats.fullRebuilds).toBe(0)
    expect(stats.capacityGrowths).toBe(0)
    expect(stats.meshesCreated).toBe(meshCountBefore)
    expect(meshes(renderer)).toHaveLength(meshCountBefore)
    expect(meshes(renderer)[0]!.geometry.positions.length).toBe(capacityBefore)
  })

  it('fully overwrites position and UV data when reusing a slot', () => {
    const layerData = makeResolvedTileLayer({
      width: 2,
      height: 1,
      tiles: [makeResolvedTile({ gid: 1, localId: 0 }), null]
    })
    const renderer = new TileLayerRenderer(layerData, [atlasTileset()], ctx)
    const mesh = meshes(renderer)[0]!

    renderer.clearTile(0, 0)
    expect(quadAt(mesh, 0)).toEqual(new Array(8).fill(0))

    // Recycles slot 0, but for a different cell and a different atlas tile.
    renderer.setTile(1, 0, makeResolvedTile({ gid: 2, localId: 1 }))

    expect(readPackedTileStats(renderer).insertsIntoFreeSlot).toBe(1)
    expect(quadAt(mesh, 0)).toEqual([32, 0, 64, 0, 64, 32, 32, 32])
    // Stale zeroed UVs must not survive the reuse.
    expect(Array.from(mesh.geometry.uvs.slice(0, 8))).not.toEqual(new Array(8).fill(0))
  })
})

describe('rebuild fallbacks', () => {
  it('opens a new alpha batch for an empty-cell insert without rebuilding', () => {
    const layerData = makeResolvedTileLayer({
      width: 2,
      height: 1,
      tiles: [makeResolvedTile(), null]
    })
    const renderer = new TileLayerRenderer(layerData, [makeTileSetRenderer()], ctx)
    const stats = readPackedTileStats(renderer)

    renderer.setTile(1, 0, makeResolvedTile({ alpha: 0.5 }))

    expect(renderer.getTile(1, 0)).toMatchObject({ alpha: 0.5 })
    expect(stats.fullRebuilds).toBe(0)
    expect(
      meshes(renderer)
        .map((mesh) => mesh.alpha)
        .sort()
    ).toEqual([0.5, 1])
  })

  it('rebuilds when an occupied cell changes alpha group', () => {
    // An in-place update cannot move a quad between alpha batches, so the
    // layer is rebuilt. Documented in docs/BENCHMARKS.md.
    const layerData = makeResolvedTileLayer({
      width: 1,
      height: 1,
      tiles: [makeResolvedTile()]
    })
    const renderer = new TileLayerRenderer(layerData, [makeTileSetRenderer()], ctx)
    const stats = readPackedTileStats(renderer)

    renderer.setTile(0, 0, makeResolvedTile({ alpha: 0.5 }))

    expect(stats.fullRebuilds).toBe(1)
    expect(renderer.children[0]?.alpha).toBe(0.5)
  })

  it('rebuilds when an occupied cell changes texture source', () => {
    const first = makeTileSetRenderer()
    const second = new TileSetRenderer(makeResolvedTileset({ columns: 1, tilecount: 1 }), null)
    second.setTileTexture(0, new Texture({ source: Texture.WHITE.source }))

    const layerData = makeResolvedTileLayer({
      width: 1,
      height: 1,
      tiles: [makeResolvedTile({ tilesetIndex: 0 })]
    })
    const renderer = new TileLayerRenderer(layerData, [first, second], ctx)

    renderer.setTile(0, 0, makeResolvedTile({ tilesetIndex: 1 }))

    expect(readPackedTileStats(renderer).fullRebuilds).toBe(1)
    expect(renderer.getTile(0, 0)).toMatchObject({ tilesetIndex: 1 })
  })

  it('rebuilds when inserting an animated tile into an empty cell', () => {
    const animated = makeTileSetRenderer({
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
    const renderer = new TileLayerRenderer(emptyLayer(2, 1), [animated], ctx)
    const stats = readPackedTileStats(renderer)

    renderer.setTile(0, 0, makeResolvedTile())

    expect(stats.fullRebuilds).toBe(1)
    expect(renderer.getTile(0, 0)).toMatchObject({ gid: 1 })
    expect(renderer.children).toHaveLength(1)
  })

  it('rebuilds when replacing a sprite-backed tile with a packed tile', () => {
    const animated = makeTileSetRenderer({
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
    const packed = makeTileSetRenderer()
    const layerData = makeResolvedTileLayer({
      width: 1,
      height: 1,
      tiles: [makeResolvedTile({ tilesetIndex: 0 })]
    })
    const renderer = new TileLayerRenderer(layerData, [animated, packed], ctx)

    renderer.setTile(0, 0, makeResolvedTile({ tilesetIndex: 1 }))

    // The animated sprite must be gone, not left behind next to a new quad.
    expect(readPackedTileStats(renderer).fullRebuilds).toBe(1)
    expect(renderer.children).toHaveLength(1)
    expect(meshes(renderer)).toHaveLength(1)
  })

  it('rebuilds for non-orthogonal maps where quad order is visually significant', () => {
    const isoCtx: MapContext = { ...ctx, orientation: 'isometric' }
    const renderer = new TileLayerRenderer(emptyLayer(4, 4), [makeTileSetRenderer()], isoCtx)
    const stats = readPackedTileStats(renderer)

    renderer.setTile(1, 1, makeResolvedTile())

    expect(stats.fullRebuilds).toBe(1)
    expect(renderer.getTile(1, 1)).toMatchObject({ gid: 1 })
  })

  it('rebuilds rather than packing an oversized seam overhang', () => {
    // tileSpritePadding is a public option with no upper bound. It widens a
    // grid-sized quad past its cell, so a large value is real overlap: an
    // appended quad would cover a neighbour that a render-order rebuild draws
    // on top. Only a sub-pixel overhang may take the fast path.
    const paddedCtx: MapContext = { ...ctx, tileSpritePadding: 4 }
    const layerData = makeResolvedTileLayer({
      width: 2,
      height: 1,
      tiles: [null, makeResolvedTile()]
    })
    const renderer = new TileLayerRenderer(layerData, [makeTileSetRenderer()], paddedCtx)

    renderer.setTile(0, 0, makeResolvedTile())

    expect(readPackedTileStats(renderer).fullRebuilds).toBe(1)
    // After the rebuild, render order is restored: left tile occupies slot 0.
    expect(quadAt(meshes(renderer)[0]!, 0)[0]).toBe(0)
    expect(quadAt(meshes(renderer)[0]!, 1)[0]).toBe(32)
  })

  it('still packs incrementally for a sub-pixel seam overhang', () => {
    const paddedCtx: MapContext = { ...ctx, tileSpritePadding: 0.01 }
    const layerData = makeResolvedTileLayer({
      width: 2,
      height: 1,
      tiles: [null, makeResolvedTile()]
    })
    const renderer = new TileLayerRenderer(layerData, [makeTileSetRenderer()], paddedCtx)

    renderer.setTile(0, 0, makeResolvedTile())

    expect(readPackedTileStats(renderer).fullRebuilds).toBe(0)
  })

  it('rebuilds when a tileset tile is taller than its grid cell', () => {
    const tall = new TileSetRenderer(
      makeResolvedTileset({ tilewidth: 32, tileheight: 64, columns: 1, tilecount: 1 }),
      Texture.EMPTY
    )
    const renderer = new TileLayerRenderer(emptyLayer(2, 2), [tall], ctx)

    renderer.setTile(0, 0, makeResolvedTile())

    // A 64px-tall quad overhangs neighbouring cells, so slot order matters.
    expect(readPackedTileStats(renderer).fullRebuilds).toBe(1)
    expect(renderer.getTile(0, 0)).toMatchObject({ gid: 1 })
  })
})

describe('grouping correctness', () => {
  it('keeps separate texture sources in separate batches', () => {
    const first = makeTileSetRenderer()
    const second = new TileSetRenderer(makeResolvedTileset({ columns: 1, tilecount: 1 }), null)
    second.setTileTexture(0, new Texture({ source: Texture.WHITE.source }))

    const layerData = makeResolvedTileLayer({
      width: 2,
      height: 1,
      tiles: [makeResolvedTile({ tilesetIndex: 0 }), null]
    })
    const renderer = new TileLayerRenderer(layerData, [first, second], ctx)

    renderer.setTile(1, 0, makeResolvedTile({ tilesetIndex: 1 }))

    expect(readPackedTileStats(renderer).fullRebuilds).toBe(0)
    expect(meshes(renderer)).toHaveLength(2)
  })

  it('does not reuse a free slot from an incompatible texture source', () => {
    const first = makeTileSetRenderer()
    const second = new TileSetRenderer(makeResolvedTileset({ columns: 1, tilecount: 1 }), null)
    second.setTileTexture(0, new Texture({ source: Texture.WHITE.source }))

    const layerData = makeResolvedTileLayer({
      width: 2,
      height: 1,
      tiles: [makeResolvedTile({ tilesetIndex: 0 }), null]
    })
    const renderer = new TileLayerRenderer(layerData, [first, second], ctx)
    const stats = readPackedTileStats(renderer)

    renderer.clearTile(0, 0)
    renderer.setTile(1, 0, makeResolvedTile({ tilesetIndex: 1 }))

    // The freed slot belongs to the first source and must not be recycled here.
    expect(stats.insertsIntoFreeSlot).toBe(0)
    expect(stats.insertsIntoNewSlot).toBe(1)
  })

  // Golden UV corner orders, pinned to literal values. These are
  // deliberately literal rather than derived, so a change to the internal flip
  // table cannot silently alter how flipped tiles render.
  it.each([
    [{}, [0, 0, 0.5, 0, 0.5, 0.5, 0, 0.5]],
    [{ horizontalFlip: true }, [0.5, 0, 0, 0, 0, 0.5, 0.5, 0.5]],
    [{ verticalFlip: true }, [0, 0.5, 0.5, 0.5, 0.5, 0, 0, 0]],
    [{ horizontalFlip: true, verticalFlip: true }, [0.5, 0.5, 0, 0.5, 0, 0, 0.5, 0]],
    [{ diagonalFlip: true }, [0, 0, 0, 0.5, 0.5, 0.5, 0.5, 0]],
    [{ diagonalFlip: true, horizontalFlip: true }, [0, 0.5, 0, 0, 0.5, 0, 0.5, 0.5]],
    [{ diagonalFlip: true, verticalFlip: true }, [0.5, 0, 0.5, 0.5, 0, 0.5, 0, 0]],
    [
      { diagonalFlip: true, horizontalFlip: true, verticalFlip: true },
      [0.5, 0.5, 0.5, 0, 0, 0, 0, 0.5]
    ]
  ])('writes the pinned UV order for flips %j', (flips, expected) => {
    const source = new TextureSource({ width: 64, height: 64 })
    const tileset = new TileSetRenderer(
      makeResolvedTileset({ columns: 2, tilecount: 4 }),
      new Texture({ source })
    )
    const renderer = new TileLayerRenderer(emptyLayer(1, 1), [tileset], ctx)

    renderer.setTile(0, 0, makeResolvedTile({ ...flips }))

    expect(readPackedTileStats(renderer).fullRebuilds).toBe(0)
    expect(Array.from(meshes(renderer)[0]!.geometry.uvs)).toEqual(expected)
  })

  it('preserves flip flags through an incremental insert', () => {
    const cases: Partial<ResolvedTile>[] = [
      { horizontalFlip: true },
      { verticalFlip: true },
      { diagonalFlip: true },
      { horizontalFlip: true, verticalFlip: true },
      { horizontalFlip: true, diagonalFlip: true },
      { verticalFlip: true, diagonalFlip: true },
      { horizontalFlip: true, verticalFlip: true, diagonalFlip: true }
    ]

    for (const flips of cases) {
      const renderer = new TileLayerRenderer(emptyLayer(1, 1), [atlasTileset()], ctx)
      const plain = new TileLayerRenderer(
        makeResolvedTileLayer({ width: 1, height: 1, tiles: [makeResolvedTile({ ...flips })] }),
        [atlasTileset()],
        ctx
      )

      renderer.setTile(0, 0, makeResolvedTile({ ...flips }))

      expect(readPackedTileStats(renderer).fullRebuilds).toBe(0)
      // An incrementally inserted tile must match a freshly built one exactly.
      expect(Array.from(meshes(renderer)[0]!.geometry.uvs)).toEqual(
        Array.from(meshes(plain)[0]!.geometry.uvs)
      )
    }
  })
})

describe('infinite layers', () => {
  it('inserts incrementally into a chunked layer', () => {
    const layerData = makeResolvedTileLayer({
      infinite: true,
      chunks: [
        makeResolvedChunk({ x: 16, y: 16, width: 2, height: 2, tiles: new Array(4).fill(null) })
      ]
    })
    const renderer = new TileLayerRenderer(layerData, [makeTileSetRenderer()], ctx)

    renderer.setTile(17, 17, makeResolvedTile())

    expect(readPackedTileStats(renderer).fullRebuilds).toBe(0)
    expect(renderer.getTile(17, 17)).toMatchObject({ gid: 1 })
    expect(layerData.chunks?.[0]?.tiles[3]).toMatchObject({ gid: 1 })
  })

  it('inserts incrementally at negative chunk coordinates', () => {
    const layerData = makeResolvedTileLayer({
      infinite: true,
      chunks: [
        makeResolvedChunk({ x: -16, y: -16, width: 2, height: 2, tiles: new Array(4).fill(null) })
      ]
    })
    const renderer = new TileLayerRenderer(layerData, [makeTileSetRenderer()], ctx)

    renderer.setTile(-16, -16, makeResolvedTile())

    expect(readPackedTileStats(renderer).fullRebuilds).toBe(0)
    expect(renderer.getTile(-16, -16)).toMatchObject({ gid: 1 })
    expect(quadAt(meshes(renderer)[0]!, 0)).toEqual([
      -512, -512, -480, -512, -480, -480, -512, -480
    ])
  })

  it('rejects coordinates outside existing chunks', () => {
    const layerData = makeResolvedTileLayer({
      infinite: true,
      chunks: [
        makeResolvedChunk({ x: 0, y: 0, width: 2, height: 2, tiles: new Array(4).fill(null) })
      ]
    })
    const renderer = new TileLayerRenderer(layerData, [makeTileSetRenderer()], ctx)

    expect(() => renderer.setTile(99, 99, makeResolvedTile())).toThrow(RangeError)
    expect(renderer.getTile(99, 99)).toBeNull()
  })
})

describe('error and coordinate semantics are unchanged', () => {
  it('rejects non-integer and out-of-range coordinates', () => {
    const renderer = new TileLayerRenderer(emptyLayer(2, 2), [makeTileSetRenderer()], ctx)

    expect(() => renderer.setTile(0.5, 0, makeResolvedTile())).toThrow(RangeError)
    expect(() => renderer.setTile(-1, 0, makeResolvedTile())).toThrow(RangeError)
    expect(() => renderer.setTile(2, 0, makeResolvedTile())).toThrow(RangeError)
    expect(renderer.getTile(0.5, 0)).toBeNull()
    expect(renderer.getTile(5, 5)).toBeNull()
  })

  it('clearing an already empty cell stays a no-op', () => {
    const renderer = new TileLayerRenderer(emptyLayer(2, 2), [makeTileSetRenderer()], ctx)

    renderer.clearTile(0, 0)

    expect(readPackedTileStats(renderer).fullRebuilds).toBe(0)
    expect(renderer.getTile(0, 0)).toBeNull()
  })
})

describe('lifecycle', () => {
  it('keeps bounds driven by the layer, not by inserted children', () => {
    const renderer = new TileLayerRenderer(emptyLayer(4, 4), [makeTileSetRenderer()], ctx)

    renderer.setTile(3, 3, makeResolvedTile())

    const bounds = renderer.getLocalBounds()
    expect(bounds.maxX).toBe(128)
    expect(bounds.maxY).toBe(128)
  })

  it('destroys cleanly after capacity growth and slot reuse', () => {
    const renderer = new TileLayerRenderer(emptyLayer(16, 16), [makeTileSetRenderer()], ctx)

    for (let i = 0; i < 200; i++) {
      renderer.setTile(i % 16, Math.floor(i / 16) % 16, makeResolvedTile())
    }
    for (let i = 0; i < 50; i++) {
      renderer.clearTile(i % 16, 0)
      renderer.setTile(i % 16, 0, makeResolvedTile())
    }

    expect(() => renderer.destroy({ children: true })).not.toThrow()
    expect(renderer.destroyed).toBe(true)
  })

  it('destroys batch textures only when the meshes go down with them', () => {
    // Container.destroy() without `children` detaches children instead of
    // destroying them, and the caller may keep them. Those meshes still
    // reference the batch texture, so it is not ours to destroy in that case.
    const makeRenderer = () =>
      new TileLayerRenderer(filledLayer(2, 1), [makeTileSetRenderer()], ctx)

    const detaching = makeRenderer()
    const detachedMesh = meshes(detaching)[0]!
    const detachedTexture = detachedMesh.texture
    detaching.destroy()
    expect(detachedMesh.destroyed).toBe(false)
    expect(detachedTexture.destroyed).toBe(false)

    const owning = makeRenderer()
    const ownedTexture = meshes(owning)[0]!.texture
    owning.destroy({ children: true })
    expect(ownedTexture.destroyed).toBe(true)
  })

  it('destroys a batch texture exactly once when Pixi owns child textures', () => {
    const source = new TextureSource({ width: 64, height: 64 })
    const tileset = new TileSetRenderer(
      makeResolvedTileset({ columns: 2, tilecount: 4 }),
      new Texture({ source })
    )
    const renderer = new TileLayerRenderer(filledLayer(2, 1), [tileset], ctx)
    const batchTexture = meshes(renderer)[0]!.texture
    const destroySpy = vi.spyOn(batchTexture, 'destroy')

    renderer.destroy({ children: true, texture: true })

    expect(destroySpy).toHaveBeenCalledTimes(1)
    expect(batchTexture.destroyed).toBe(true)
    expect(source.destroyed).toBe(false)

    destroySpy.mockRestore()
    source.destroy()
  })

  it('destroys cleanly through TiledMap after edits', () => {
    const ground = makeResolvedTileLayer({
      name: 'ground',
      width: 4,
      height: 4,
      tiles: new Array(16).fill(null)
    })
    const map = new TiledMap(
      makeResolvedMap({
        width: 4,
        height: 4,
        tilesets: [makeResolvedTileset({ name: 'base', firstgid: 1, tilecount: 4 })],
        layers: [ground]
      })
    )

    map.setTile('ground', 1, 1, 1)
    map.clearTile('ground', 1, 1)
    map.setTile('ground', 2, 2, 1)

    expect(() => map.destroy({ children: true })).not.toThrow()
  })
})

describe('caller-added children', () => {
  function animatedTileset() {
    return makeTileSetRenderer({
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
  }

  it('keeps a child added above the tiles through a rebuild', () => {
    const renderer = new TileLayerRenderer(filledLayer(2, 1), [makeTileSetRenderer()], ctx)
    const player = new Sprite(Texture.WHITE)
    renderer.addChild(player)

    renderer.setTile(0, 0, makeResolvedTile({ alpha: 0.5 }))

    expect(readPackedTileStats(renderer).fullRebuilds).toBe(1)
    expect(player.destroyed).toBe(false)
    expect(player.parent).toBe(renderer)
    expect(renderer.children.at(-1)).toBe(player)
    expect(
      meshes(renderer)
        .map((mesh) => mesh.alpha)
        .sort()
    ).toEqual([0.5, 1])
  })

  it('keeps a child added below the tiles below them through a rebuild', () => {
    const renderer = new TileLayerRenderer(filledLayer(2, 1), [makeTileSetRenderer()], ctx)
    const backdrop = new Container()
    renderer.addChildAt(backdrop, 0)

    renderer.setTile(0, 0, makeResolvedTile({ alpha: 0.5 }))

    expect(backdrop.destroyed).toBe(false)
    expect(renderer.children[0]).toBe(backdrop)
    expect(renderer.children).toHaveLength(3)
  })

  it('keeps caller children through a rebuild of sprite-backed tiles', () => {
    const renderer = new TileLayerRenderer(emptyLayer(2, 1), [animatedTileset()], ctx)
    const player = new Sprite(Texture.WHITE)
    renderer.addChild(player)

    renderer.setTile(0, 0, makeResolvedTile())
    renderer.setTile(1, 0, makeResolvedTile())

    expect(readPackedTileStats(renderer).fullRebuilds).toBe(2)
    expect(player.destroyed).toBe(false)
    expect(renderer.children).toHaveLength(3)
    expect(renderer.children.at(-1)).toBe(player)
  })

  it('places a mesh opened by an incremental insert below caller children', () => {
    const first = makeTileSetRenderer()
    const second = new TileSetRenderer(makeResolvedTileset({ columns: 1, tilecount: 1 }), null)
    second.setTileTexture(0, new Texture({ source: Texture.WHITE.source }))
    const layerData = makeResolvedTileLayer({
      width: 2,
      height: 1,
      tiles: [makeResolvedTile({ tilesetIndex: 0 }), null]
    })
    const renderer = new TileLayerRenderer(layerData, [first, second], ctx)
    const player = new Sprite(Texture.WHITE)
    renderer.addChild(player)

    renderer.setTile(1, 0, makeResolvedTile({ tilesetIndex: 1 }))

    expect(readPackedTileStats(renderer).fullRebuilds).toBe(0)
    expect(meshes(renderer)).toHaveLength(2)
    expect(renderer.children.at(-1)).toBe(player)
  })

  it('keeps tile children in render order between caller children', () => {
    const renderer = new TileLayerRenderer(emptyLayer(2, 1), [animatedTileset()], ctx)
    const below = new Container()
    const above = new Container()
    renderer.setTile(0, 0, makeResolvedTile())
    renderer.addChildAt(below, 0)
    renderer.addChild(above)

    renderer.setTile(1, 0, makeResolvedTile())

    const tiles = renderer.children.filter((child) => child !== below && child !== above)
    expect(renderer.children).toEqual([below, ...tiles, above])
    expect(tiles.map((tile) => tile.x)).toEqual([0, 32])
  })

  it('still destroys caller children when the layer is destroyed with its children', () => {
    const renderer = new TileLayerRenderer(filledLayer(1, 1), [makeTileSetRenderer()], ctx)
    const player = new Sprite(Texture.WHITE)
    renderer.addChild(player)

    renderer.destroy({ children: true })

    expect(player.destroyed).toBe(true)
  })
})
