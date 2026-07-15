/**
 * @vitest-environment jsdom
 *
 * Long deterministic edit sequences. These guard the properties that only show
 * up over time: slot recycling, bounded capacity, handle validity, and that the
 * rendered geometry still agrees with the layer data after tens of thousands of
 * mutations.
 */
import { type Mesh, Texture } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { readPackedTileStats } from '../../src/renderer/packedTileStats.js'
import { TileLayerRenderer } from '../../src/renderer/TileLayerRenderer.js'
import { TileSetRenderer } from '../../src/renderer/TileSetRenderer.js'
import type { MapContext, ResolvedTile, ResolvedTileLayer } from '../../src/types/index.js'
import {
  makeResolvedChunk,
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
  tileSpritePadding: 0.01
}

/** Deterministic LCG so a failure always reproduces. */
function makeRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x1_0000_0000
  }
}

function meshes(renderer: TileLayerRenderer): Mesh[] {
  return renderer.children.filter((child) => 'geometry' in child) as Mesh[]
}

const DEGENERATE = new Array(8).fill(0)

function isDegenerate(positions: Float32Array, slot: number): boolean {
  for (let i = slot * 8; i < slot * 8 + 8; i++) {
    if (positions[i] !== 0) return false
  }
  return true
}

/** Every live quad in the layer, keyed by its top-left corner. */
function liveQuadCorners(renderer: TileLayerRenderer): Set<string> {
  const corners = new Set<string>()
  for (const mesh of meshes(renderer)) {
    const positions = mesh.geometry.positions
    for (let slot = 0; slot < positions.length / 8; slot++) {
      if (isDegenerate(positions, slot)) continue
      corners.add(`${positions[slot * 8]},${positions[slot * 8 + 1]}`)
    }
  }
  return corners
}

function totalQuadCapacity(renderer: TileLayerRenderer): number {
  let capacity = 0
  for (const mesh of meshes(renderer)) capacity += mesh.geometry.positions.length / 8
  return capacity
}

function countLiveQuads(renderer: TileLayerRenderer): number {
  let count = 0
  for (const mesh of meshes(renderer)) {
    const positions = mesh.geometry.positions
    for (let slot = 0; slot < positions.length / 8; slot++) {
      if (!isDegenerate(positions, slot)) count++
    }
  }
  return count
}

/** Corners the layer data says should be drawn, for an orthogonal finite layer. */
function expectedCorners(layerData: ResolvedTileLayer): Set<string> {
  const corners = new Set<string>()
  for (let row = 0; row < layerData.height; row++) {
    for (let col = 0; col < layerData.width; col++) {
      if (layerData.tiles[row * layerData.width + col]) {
        corners.add(`${col * ctx.tilewidth},${row * ctx.tileheight}`)
      }
    }
  }
  return corners
}

function countNonNull(tiles: (ResolvedTile | null)[]): number {
  let count = 0
  for (const tile of tiles) if (tile) count++
  return count
}

describe('long edit sequences', () => {
  it('keeps a homogeneous finite layer consistent and bounded over 30k edits', () => {
    const size = 32
    const layerData = makeResolvedTileLayer({
      width: size,
      height: size,
      tiles: new Array(size * size).fill(null)
    })
    const renderer = new TileLayerRenderer(layerData, [makeTileSetRenderer()], ctx)
    const stats = readPackedTileStats(renderer)
    const rng = makeRng(0x5eed)

    for (let i = 0; i < 30_000; i++) {
      const col = Math.floor(rng() * size)
      const row = Math.floor(rng() * size)
      if (rng() < 0.4) {
        renderer.clearTile(col, row)
      } else {
        renderer.setTile(col, row, makeResolvedTile())
      }
    }

    // A single texture source and alpha never needs a structural rebuild.
    expect(stats.fullRebuilds).toBe(0)
    expect(liveQuadCorners(renderer)).toEqual(expectedCorners(layerData))
    expect(countLiveQuads(renderer)).toBe(countNonNull(layerData.tiles))

    // Capacity is bounded by the cells that can exist, not by the edit count.
    expect(totalQuadCapacity(renderer)).toBeLessThanOrEqual(size * size)
    expect(meshes(renderer)).toHaveLength(1)
    expect(stats.meshesCreated).toBe(1)
    expect(stats.meshesDestroyed).toBe(0)

    // Slot recycling must carry the bulk of the inserts, otherwise capacity
    // would have had to grow towards the number of operations.
    expect(stats.insertsIntoFreeSlot).toBeGreaterThan(stats.insertsIntoNewSlot)
    expect(stats.insertsIntoNewSlot).toBeLessThanOrEqual(size * size)
  })

  it('does not grow capacity across repeated clear/set of the same cells', () => {
    const layerData = makeResolvedTileLayer({
      width: 8,
      height: 8,
      tiles: Array.from({ length: 64 }, () => makeResolvedTile())
    })
    const renderer = new TileLayerRenderer(layerData, [makeTileSetRenderer()], ctx)
    const stats = readPackedTileStats(renderer)
    const capacityBefore = totalQuadCapacity(renderer)

    for (let i = 0; i < 10_000; i++) {
      const col = i % 8
      const row = (i >> 3) % 8
      renderer.clearTile(col, row)
      renderer.setTile(col, row, makeResolvedTile())
    }

    expect(stats.fullRebuilds).toBe(0)
    expect(stats.capacityGrowths).toBe(0)
    expect(totalQuadCapacity(renderer)).toBe(capacityBefore)
    expect(stats.insertsIntoNewSlot).toBe(0)
    expect(stats.insertsIntoFreeSlot).toBe(10_000)
    expect(countLiveQuads(renderer)).toBe(64)
  })

  it('keeps 10k updates of existing tiles on the partial path', () => {
    const layerData = makeResolvedTileLayer({
      width: 16,
      height: 16,
      tiles: Array.from({ length: 256 }, () => makeResolvedTile({ gid: 1, localId: 0 }))
    })
    const tileset = new TileSetRenderer(
      makeResolvedTileset({ columns: 2, tilecount: 4 }),
      Texture.EMPTY
    )
    const renderer = new TileLayerRenderer(layerData, [tileset], ctx)
    const stats = readPackedTileStats(renderer)
    const rng = makeRng(0xc0ffee)

    for (let i = 0; i < 10_000; i++) {
      const col = Math.floor(rng() * 16)
      const row = Math.floor(rng() * 16)
      const localId = i % 2
      renderer.setTile(col, row, makeResolvedTile({ gid: localId + 1, localId }))
    }

    expect(stats.fullRebuilds).toBe(0)
    expect(stats.insertsIntoNewSlot).toBe(0)
    expect(stats.insertsIntoFreeSlot).toBe(0)
    expect(stats.capacityGrowths).toBe(0)
    expect(countLiveQuads(renderer)).toBe(256)
  })

  it('stays consistent with mixed texture sources and alpha groups', () => {
    const first = makeTileSetRenderer()
    const second = new TileSetRenderer(makeResolvedTileset({ columns: 1, tilecount: 1 }), null)
    second.setTileTexture(0, new Texture({ source: Texture.WHITE.source }))

    const size = 16
    const layerData = makeResolvedTileLayer({
      width: size,
      height: size,
      tiles: new Array(size * size).fill(null)
    })
    const renderer = new TileLayerRenderer(layerData, [first, second], ctx)
    const stats = readPackedTileStats(renderer)
    const rng = makeRng(0xbeef)

    for (let i = 0; i < 20_000; i++) {
      const col = Math.floor(rng() * size)
      const row = Math.floor(rng() * size)
      if (rng() < 0.35) {
        renderer.clearTile(col, row)
        continue
      }
      renderer.setTile(
        col,
        row,
        makeResolvedTile({
          tilesetIndex: rng() < 0.5 ? 0 : 1,
          alpha: rng() < 0.5 ? 1 : 0.5
        })
      )
    }

    expect(liveQuadCorners(renderer)).toEqual(expectedCorners(layerData))
    expect(countLiveQuads(renderer)).toBe(countNonNull(layerData.tiles))

    // At most one mesh per (texture source x alpha) combination.
    expect(meshes(renderer).length).toBeLessThanOrEqual(4)
    // Capacity per group cannot exceed the cell count of the layer.
    expect(totalQuadCapacity(renderer)).toBeLessThanOrEqual(4 * size * size)
    expect(stats.meshesCreated).toBeLessThanOrEqual(4 + stats.fullRebuilds * 4)
  })

  it('keeps an infinite chunked layer consistent across negative coordinates', () => {
    const chunks = []
    for (let cy = -1; cy <= 0; cy++) {
      for (let cx = -1; cx <= 0; cx++) {
        chunks.push(
          makeResolvedChunk({
            x: cx * 16,
            y: cy * 16,
            width: 16,
            height: 16,
            tiles: new Array(256).fill(null)
          })
        )
      }
    }
    const layerData = makeResolvedTileLayer({ infinite: true, tiles: [], chunks })
    const renderer = new TileLayerRenderer(layerData, [makeTileSetRenderer()], ctx)
    const stats = readPackedTileStats(renderer)
    const rng = makeRng(0xfeed)

    for (let i = 0; i < 20_000; i++) {
      const col = Math.floor(rng() * 32) - 16
      const row = Math.floor(rng() * 32) - 16
      if (rng() < 0.4) renderer.clearTile(col, row)
      else renderer.setTile(col, row, makeResolvedTile())
    }

    expect(stats.fullRebuilds).toBe(0)

    let expected = 0
    const expectedSet = new Set<string>()
    for (const chunk of layerData.chunks ?? []) {
      for (let row = 0; row < chunk.height; row++) {
        for (let col = 0; col < chunk.width; col++) {
          if (!chunk.tiles[row * chunk.width + col]) continue
          expected++
          expectedSet.add(`${(chunk.x + col) * ctx.tilewidth},${(chunk.y + row) * ctx.tileheight}`)
        }
      }
    }

    expect(countLiveQuads(renderer)).toBe(expected)
    expect(liveQuadCorners(renderer)).toEqual(expectedSet)
    expect(totalQuadCapacity(renderer)).toBeLessThanOrEqual(4 * 256)
  })

  it('releases resources after a long edit sequence', () => {
    const renderer = new TileLayerRenderer(
      makeResolvedTileLayer({ width: 16, height: 16, tiles: new Array(256).fill(null) }),
      [makeTileSetRenderer()],
      ctx
    )
    const rng = makeRng(0xd00d)

    for (let i = 0; i < 5_000; i++) {
      const col = Math.floor(rng() * 16)
      const row = Math.floor(rng() * 16)
      if (rng() < 0.5) renderer.clearTile(col, row)
      else renderer.setTile(col, row, makeResolvedTile())
    }

    const built = meshes(renderer)
    renderer.destroy({ children: true })

    expect(renderer.destroyed).toBe(true)
    for (const mesh of built) expect(mesh.destroyed).toBe(true)
  })
})

describe('degenerate slots stay invisible', () => {
  it('leaves released slots fully zeroed', () => {
    const renderer = new TileLayerRenderer(
      makeResolvedTileLayer({
        width: 4,
        height: 1,
        tiles: Array.from({ length: 4 }, () => makeResolvedTile())
      }),
      [makeTileSetRenderer()],
      ctx
    )

    renderer.clearTile(1, 0)
    renderer.clearTile(2, 0)

    const mesh = meshes(renderer)[0]!
    expect(Array.from(mesh.geometry.positions.slice(8, 16))).toEqual(DEGENERATE)
    expect(Array.from(mesh.geometry.positions.slice(16, 24))).toEqual(DEGENERATE)
    expect(Array.from(mesh.geometry.uvs.slice(8, 16))).toEqual(DEGENERATE)
  })
})
