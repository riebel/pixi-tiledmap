/**
 * @vitest-environment jsdom
 *
 * Runtime tile-editing hot paths. Companion to TileLayerRenderer.bench.ts,
 * which covers initial layer construction.
 *
 * Each bench rebuilds its own renderer inside the timed body where the
 * operation mutates layer state, so repeated iterations stay comparable.
 * See docs/BENCHMARKS.md before changing these.
 */

import { Texture } from 'pixi.js'
import { bench, describe } from 'vitest'
import { TileLayerRenderer } from '../../src/renderer/TileLayerRenderer.js'
import { TileSetRenderer } from '../../src/renderer/TileSetRenderer.js'
import type { MapContext, ResolvedChunk, ResolvedTile } from '../../src/types/index.js'
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

const tileset = makeTileSetRenderer()

function atlasTileset() {
  return new TileSetRenderer(makeResolvedTileset({ columns: 2, tilecount: 4 }), Texture.EMPTY)
}

function emptyLayer(size: number) {
  return makeResolvedTileLayer({
    width: size,
    height: size,
    tiles: new Array(size * size).fill(null)
  })
}

function fullLayer(size: number, factory: () => ResolvedTile = makeResolvedTile) {
  return makeResolvedTileLayer({
    width: size,
    height: size,
    tiles: Array.from({ length: size * size }, factory)
  })
}

/** Deterministic LCG so every run edits the same cells. */
function makeRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x1_0000_0000
  }
}

function newRenderer(size: number, empty: boolean) {
  return new TileLayerRenderer(empty ? emptyLayer(size) : fullLayer(size), [tileset], ctx)
}

describe('single insert into an empty cell', () => {
  for (const size of [32, 256, 512]) {
    bench(`${size}x${size} empty layer, 1 insert`, () => {
      const renderer = newRenderer(size, true)
      renderer.setTile(size >> 1, size >> 1, makeResolvedTile())
      renderer.destroy({ children: true })
    })
  }
})

describe('bulk inserts into empty cells', () => {
  for (const count of [100, 10_000]) {
    bench(`${count} inserts into a 256x256 empty layer`, () => {
      const renderer = newRenderer(256, true)
      for (let i = 0; i < count; i++) {
        renderer.setTile(i % 256, Math.floor(i / 256), makeResolvedTile())
      }
      renderer.destroy({ children: true })
    })
  }

  bench('contiguous 64x64 paint region in a 256x256 empty layer', () => {
    const renderer = newRenderer(256, true)
    for (let row = 0; row < 64; row++) {
      for (let col = 0; col < 64; col++) {
        renderer.setTile(col, row, makeResolvedTile())
      }
    }
    renderer.destroy({ children: true })
  })

  bench('10000 seeded random inserts into a 512x512 empty layer', () => {
    const renderer = newRenderer(512, true)
    const rng = makeRng(0x51ee)
    for (let i = 0; i < 10_000; i++) {
      renderer.setTile(Math.floor(rng() * 512), Math.floor(rng() * 512), makeResolvedTile())
    }
    renderer.destroy({ children: true })
  })
})

describe('updates of existing tiles', () => {
  bench('10000 compatible updates in a 256x256 dense layer', () => {
    const renderer = new TileLayerRenderer(fullLayer(256), [atlasTileset()], ctx)
    for (let i = 0; i < 10_000; i++) {
      const localId = i % 2
      renderer.setTile(
        i % 256,
        Math.floor(i / 256),
        makeResolvedTile({ gid: localId + 1, localId })
      )
    }
    renderer.destroy({ children: true })
  })

  bench('10000 no-op updates in a 256x256 dense layer', () => {
    const renderer = newRenderer(256, false)
    for (let i = 0; i < 10_000; i++) {
      renderer.setTile(i % 256, Math.floor(i / 256), makeResolvedTile())
    }
    renderer.destroy({ children: true })
  })

  bench('1000 incompatible alpha updates in a 64x64 dense layer (rebuild fallback)', () => {
    const renderer = newRenderer(64, false)
    for (let i = 0; i < 1000; i++) {
      renderer.setTile(i % 64, Math.floor(i / 64), makeResolvedTile({ alpha: i % 2 ? 0.5 : 1 }))
    }
    renderer.destroy({ children: true })
  })
})

describe('clear/set cycles', () => {
  bench('10000 clear/set cycles in a 64x64 dense layer', () => {
    const renderer = newRenderer(64, false)
    for (let i = 0; i < 10_000; i++) {
      const col = i % 64
      const row = Math.floor(i / 64) % 64
      renderer.clearTile(col, row)
      renderer.setTile(col, row, makeResolvedTile())
    }
    renderer.destroy({ children: true })
  })
})

describe('occupancy variants', () => {
  bench('1000 inserts into a sparse 512x512 layer', () => {
    const renderer = newRenderer(512, true)
    const rng = makeRng(0x5a2e)
    for (let i = 0; i < 1000; i++) {
      renderer.setTile(Math.floor(rng() * 512), Math.floor(rng() * 512), makeResolvedTile())
    }
    renderer.destroy({ children: true })
  })

  bench('1000 inserts across multiple texture sources', () => {
    const second = new TileSetRenderer(makeResolvedTileset({ columns: 1, tilecount: 1 }), null)
    second.setTileTexture(0, new Texture({ source: Texture.WHITE.source }))
    const renderer = new TileLayerRenderer(emptyLayer(64), [tileset, second], ctx)

    for (let i = 0; i < 1000; i++) {
      renderer.setTile(
        i % 64,
        Math.floor(i / 64),
        makeResolvedTile({ tilesetIndex: i % 2, gid: 1 })
      )
    }
    renderer.destroy({ children: true })
  })

  bench('1000 inserts across multiple alpha groups', () => {
    const renderer = newRenderer(64, true)
    for (let i = 0; i < 1000; i++) {
      renderer.setTile(i % 64, Math.floor(i / 64), makeResolvedTile({ alpha: i % 2 ? 0.5 : 1 }))
    }
    renderer.destroy({ children: true })
  })
})

describe('infinite layers', () => {
  function infiniteLayer() {
    const chunks: ResolvedChunk[] = []
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        chunks.push(
          makeResolvedChunk({
            x: (x - 2) * 16,
            y: (y - 2) * 16,
            width: 16,
            height: 16,
            tiles: new Array(256).fill(null)
          })
        )
      }
    }
    return makeResolvedTileLayer({ infinite: true, tiles: [], chunks })
  }

  bench('1000 inserts into a 16-chunk infinite layer', () => {
    const renderer = new TileLayerRenderer(infiniteLayer(), [tileset], ctx)
    const rng = makeRng(0xc4a5)
    for (let i = 0; i < 1000; i++) {
      renderer.setTile(Math.floor(rng() * 64) - 32, Math.floor(rng() * 64) - 32, makeResolvedTile())
    }
    renderer.destroy({ children: true })
  })
})
