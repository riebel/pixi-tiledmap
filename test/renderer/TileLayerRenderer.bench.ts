/**
 * @vitest-environment jsdom
 */

import { bench, describe } from 'vitest'
import { TileLayerRenderer } from '../../src/renderer/TileLayerRenderer.js'
import type { MapContext, ResolvedChunk } from '../../src/types/index.js'
import {
  makeResolvedChunk,
  makeResolvedTile,
  makeResolvedTileLayer,
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

function makeTiles(count: number) {
  return Array.from({ length: count }, () => makeResolvedTile())
}

describe('TileLayerRenderer hot path', () => {
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
})
