import type { MapContext, ResolvedChunk, ResolvedTile, ResolvedTileLayer } from '../types'
import { getTileIterationPlan, tileToPixel } from './mapGeometry.js'
import { PackedTileLayerRenderer, type PackedTileRenderHandle } from './PackedTileLayerRenderer.js'
import { applyLayerState } from './renderableLayer.js'
import type { TileSetRenderer } from './TileSetRenderer.js'

export class TileLayerRenderer extends PackedTileLayerRenderer {
  readonly layerData: ResolvedTileLayer
  private readonly _tilesets: TileSetRenderer[]
  private readonly _ctx: MapContext
  private readonly _cellRenderHandles = new Map<string, PackedTileRenderHandle>()

  constructor(layerData: ResolvedTileLayer, tilesets: TileSetRenderer[], ctx: MapContext) {
    super(estimateTileCapacity(layerData), ctx.tileMeshBatchSize)

    this.layerData = layerData
    this._tilesets = tilesets
    this._ctx = ctx
    applyLayerState(this, layerData)

    this._buildLayer()
  }

  getTile(col: number, row: number): ResolvedTile | null {
    const cell = this._findCell(col, row)
    return cell ? (cell.tiles[cell.index] ?? null) : null
  }

  setTile(col: number, row: number, tile: ResolvedTile | null): void {
    const cell = this._findCell(col, row)
    if (!cell) {
      throw new RangeError(
        `Tile coordinate (${col}, ${row}) is outside layer "${this.layerData.name}".`
      )
    }

    const nextTile = tile ? { ...tile } : null
    const key = getCellKey(col, row)
    const handle = this._cellRenderHandles.get(key)
    const previousTile = cell.tiles[cell.index] ?? null

    cell.tiles[cell.index] = nextTile

    if (!nextTile) {
      if (!previousTile) {
        this._cellRenderHandles.delete(key)
        return
      }

      if (handle && this.clearPackedTile(handle)) {
        this._cellRenderHandles.delete(key)
        return
      }
      this._rebuildLayer()
      return
    }

    const tsRenderer = this._tilesets[nextTile.tilesetIndex]
    if (handle && tsRenderer) {
      const pos = tileToPixel(col, row, this._ctx)
      if (this.updatePackedTile(handle, nextTile, tsRenderer, pos.x, pos.y, this._ctx)) {
        return
      }
    }

    this._rebuildLayer()
  }

  clearTile(col: number, row: number): void {
    this.setTile(col, row, null)
  }

  private _buildLayer(): void {
    this._cellRenderHandles.clear()

    if (this.layerData.infinite && this.layerData.chunks) {
      this._buildChunks(this.layerData.chunks, this._tilesets, this._ctx)
    } else {
      this._buildTiles(
        this.layerData.tiles,
        this.layerData.width,
        Math.floor(this.layerData.tiles.length / (this.layerData.width || 1)),
        0,
        0,
        this._tilesets,
        this._ctx
      )
    }

    this.finalize()
  }

  private _rebuildLayer(): void {
    for (const child of this.removeChildren()) {
      child.destroy()
    }
    this._buildLayer()
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
        const handle = this.addTile(tile, tsRenderer, pos.x, pos.y, ctx)
        if (handle) {
          this._cellRenderHandles.set(getCellKey(originCol + col, originRow + row), handle)
        }
      }
    }
  }

  private _findCell(
    col: number,
    row: number
  ): { tiles: (ResolvedTile | null)[]; index: number } | null {
    if (!Number.isInteger(col) || !Number.isInteger(row)) return null

    if (this.layerData.infinite && this.layerData.chunks) {
      for (const chunk of this.layerData.chunks) {
        const localCol = col - chunk.x
        const localRow = row - chunk.y
        if (localCol < 0 || localRow < 0 || localCol >= chunk.width || localRow >= chunk.height) {
          continue
        }
        return { tiles: chunk.tiles, index: localRow * chunk.width + localCol }
      }
      return null
    }

    if (col < 0 || row < 0 || col >= this.layerData.width || row >= this.layerData.height) {
      return null
    }

    return { tiles: this.layerData.tiles, index: row * this.layerData.width + col }
  }
}

function getCellKey(col: number, row: number): string {
  return `${col},${row}`
}

function estimateTileCapacity(layerData: ResolvedTileLayer): number {
  if (layerData.infinite && layerData.chunks) {
    let count = 0
    for (const chunk of layerData.chunks) count += chunk.tiles.length
    return count
  }

  return layerData.tiles.length
}
