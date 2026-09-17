/**
 * @vitest-environment jsdom
 */

import { BufferImageSource, Texture } from 'pixi.js'
import { TileLayerRenderer } from '../../src/renderer/TileLayerRenderer.js'
import { TileSetRenderer } from '../../src/renderer/TileSetRenderer.js'
import type { MapContext, ResolvedChunk } from '../../src/types/index.js'
import { benchGroup } from '../helpers/bench.js'
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

const legacyBatchCtx: MapContext = {
  ...ctx,
  tileMeshBatchSize: 2000
}

const tileset = makeTileSetRenderer()
// A second texture source, so alternating tiles need a second mesh.
const otherTileset = new TileSetRenderer(makeResolvedTileset({ name: 'other' }), null)
otherTileset.setTileTexture(
  0,
  new Texture({
    source: new BufferImageSource({ resource: new Uint8Array(32 * 32 * 4), width: 32, height: 32 })
  })
)

function makeTiles(count: number) {
  return Array.from({ length: count }, () => makeResolvedTile())
}

benchGroup('TileLayerRenderer hot path', (bench) => {
  bench('finite 64x64 tile layer legacy 2k batches', () => {
    const renderer = new TileLayerRenderer(
      makeResolvedTileLayer({
        width: 64,
        height: 64,
        tiles: makeTiles(64 * 64)
      }),
      [tileset],
      legacyBatchCtx
    )
    renderer.destroy({ children: true })
  })

  bench('finite 256x256 tile layer from two alternating tilesets', () => {
    const tiles = Array.from({ length: 256 * 256 }, (_, index) =>
      makeResolvedTile({ tilesetIndex: ((index % 256) + Math.floor(index / 256)) % 2 })
    )
    const renderer = new TileLayerRenderer(
      makeResolvedTileLayer({ width: 256, height: 256, tiles }),
      [tileset, otherTileset],
      ctx
    )
    renderer.destroy({ children: true })
  })

  bench('finite 64x64 tile layer', () => {
    const renderer = new TileLayerRenderer(
      makeResolvedTileLayer({
        width: 64,
        height: 64,
        tiles: makeTiles(64 * 64)
      }),
      [tileset],
      ctx
    )
    renderer.destroy({ children: true })
  })

  bench('infinite 16 chunks of 16x16 tiles', () => {
    const chunks: ResolvedChunk[] = []
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        chunks.push(
          makeResolvedChunk({
            x: x * 16,
            y: y * 16,
            width: 16,
            height: 16,
            tiles: makeTiles(16 * 16)
          })
        )
      }
    }

    const renderer = new TileLayerRenderer(
      makeResolvedTileLayer({
        infinite: true,
        tiles: [],
        chunks
      }),
      [tileset],
      ctx
    )
    renderer.destroy({ children: true })
  })

  bench('animated finite 64x64 tile layer', () => {
    const animatedTileset = makeTileSetRenderer({
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
    const renderer = new TileLayerRenderer(
      makeResolvedTileLayer({
        width: 64,
        height: 64,
        tiles: makeTiles(64 * 64)
      }),
      [animatedTileset],
      ctx
    )
    renderer.destroy({ children: true })
  })
})
