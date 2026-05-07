import type { MapContext, ResolvedChunk, ResolvedTile, ResolvedTileLayer } from '../types'
import { getTileIterationPlan, tileToPixel } from './mapGeometry.js'
import { PackedTileLayerRenderer } from './PackedTileLayerRenderer.js'
import { applyLayerState } from './renderableLayer.js'
import type { TileSetRenderer } from './TileSetRenderer.js'

export class TileLayerRenderer extends PackedTileLayerRenderer {
  readonly layerData: ResolvedTileLayer

  constructor(layerData: ResolvedTileLayer, tilesets: TileSetRenderer[], ctx: MapContext) {
    super(estimateTileCapacity(layerData))

    this.layerData = layerData
    applyLayerState(this, layerData)

    if (layerData.infinite && layerData.chunks) {
      this._buildChunks(layerData.chunks, tilesets, ctx)
    } else {
      this._buildTiles(
        layerData.tiles,
        layerData.width,
        Math.floor(layerData.tiles.length / (layerData.width || 1)),
        0,
        0,
        tilesets,
        ctx
      )
    }

    this.finalize()
  }

  private _buildChunks(
    chunks: ResolvedChunk[],
    tilesets: TileSetRenderer[],
    ctx: MapContext
  ): void {
    for (const chunk of chunks) {
      this._buildTiles(chunk.tiles, chunk.width, chunk.height, chunk.x, chunk.y, tilesets, ctx)
    }
  }

  private _buildTiles(
    tiles: (ResolvedTile | null)[],
    layerWidth: number,
    layerHeight: number,
    originCol: number,
    originRow: number,
    tilesets: TileSetRenderer[],
    ctx: MapContext
  ): void {
    const plan = getTileIterationPlan(layerWidth, layerHeight, ctx)

    for (let row = plan.rowStart; row !== plan.rowEnd; row += plan.rowStep) {
      const rowOffset = row * layerWidth
      for (let col = plan.colStart; col !== plan.colEnd; col += plan.colStep) {
        const tile = tiles[rowOffset + col]
        if (!tile) continue

        const tsRenderer = tilesets[tile.tilesetIndex]
        if (!tsRenderer) continue

        // Read x/y immediately - tileToPixel returns a reusable object.
        const pos = tileToPixel(originCol + col, originRow + row, ctx)
        this.addTile(tile, tsRenderer, pos.x, pos.y, ctx)
      }
    }
  }
}

function estimateTileCapacity(layerData: ResolvedTileLayer): number {
  if (layerData.infinite && layerData.chunks) {
    let count = 0
    for (const chunk of layerData.chunks) count += chunk.tiles.length
    return count
  }

  return layerData.tiles.length
}
