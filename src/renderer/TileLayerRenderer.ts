import type { MapContext, ResolvedChunk, ResolvedTile, ResolvedTileLayer } from '../types'
import { getTileIterationPlan, tileToPixel } from './mapGeometry.js'
import { PackedTileLayerRenderer, type PackedTileRenderHandle } from './PackedTileLayerRenderer.js'
import { packedTileStatsSymbol } from './packedTileStats.js'
import { applyLayerState } from './renderableLayer.js'
import type { TileSetRenderer } from './TileSetRenderer.js'

export class TileLayerRenderer extends PackedTileLayerRenderer {
  readonly layerData: ResolvedTileLayer
  private readonly _tilesets: TileSetRenderer[]
  private readonly _ctx: MapContext
  /**
   * Render handles of packed cells, per tile array (the layer's, or a chunk's)
   * and indexed like it, so a lookup needs no coordinate key.
   */
  private readonly _cellRenderHandles = new Map<
    (ResolvedTile | null)[],
    (PackedTileRenderHandle | undefined)[]
  >()

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
    const handle = this._cellRenderHandles.get(cell.tiles)?.[cell.index]
    const previousTile = cell.tiles[cell.index] ?? null

    cell.tiles[cell.index] = nextTile

    const applied = nextTile
      ? this._packCell(cell, col, row, handle, previousTile, nextTile)
      : this._clearCell(cell, handle, previousTile)
    if (!applied) this._rebuildLayer()
  }

  /** Clears a cell without a rebuild; false when only a rebuild can. */
  private _clearCell(
    cell: TileCell,
    handle: PackedTileRenderHandle | undefined,
    previousTile: ResolvedTile | null
  ): boolean {
    if (!previousTile) return true
    if (!handle || !this.clearPackedTile(handle)) return false
    this._setHandle(cell, undefined)
    return true
  }

  /** Packs `nextTile` into a cell without a rebuild; false when only a rebuild can. */
  private _packCell(
    cell: TileCell,
    col: number,
    row: number,
    handle: PackedTileRenderHandle | undefined,
    previousTile: ResolvedTile | null,
    nextTile: ResolvedTile
  ): boolean {
    const tsRenderer = this._tilesets[nextTile.tilesetIndex]
    if (!tsRenderer) return false

    const pos = tileToPixel(col, row, this._ctx)
    const x = pos.x
    const y = pos.y

    if (handle) {
      if (this.updatePackedTile(handle, nextTile, tsRenderer, x, y, this._ctx)) return true
      // The quad needs another batch (texture source or alpha). While quads
      // cannot overlap, moving it is a clear plus an insert; the insert
      // declines exactly the cases that still need a rebuild.
      if (!this.clearPackedTile(handle)) return false
      this._setHandle(cell, undefined)
    } else if (previousTile) {
      // A previous tile without a handle means a sprite-backed visual is still
      // attached to this cell, which only a rebuild can remove.
      return false
    }

    const inserted = this.insertPackedTile(nextTile, tsRenderer, x, y, this._ctx)
    if (!inserted) return false
    this._setHandle(cell, inserted)
    return true
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
    this[packedTileStatsSymbol].fullRebuilds++
    this.resetPackedTiles()
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
    let handles: (PackedTileRenderHandle | undefined)[] | undefined

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
          handles ??= this._handlesFor(tiles)
          handles[rowOffset + col] = handle
        }
      }
    }
  }

  private _setHandle(cell: TileCell, handle: PackedTileRenderHandle | undefined): void {
    this._handlesFor(cell.tiles)[cell.index] = handle
  }

  /** Allocated on the first handle, so tile arrays that pack nothing cost nothing. */
  private _handlesFor(tiles: (ResolvedTile | null)[]): (PackedTileRenderHandle | undefined)[] {
    let handles = this._cellRenderHandles.get(tiles)
    if (!handles) {
      // Grown on demand: a dense layer fills it in order and keeps fast
      // elements, a sparse one stays small instead of costing a slot per cell.
      handles = []
      this._cellRenderHandles.set(tiles, handles)
    }
    return handles
  }

  private _findCell(col: number, row: number): TileCell | null {
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

/** A cell's slot in the tile array (the layer's, or a chunk's) that holds it. */
interface TileCell {
  tiles: (ResolvedTile | null)[]
  index: number
}

/**
 * Counts the tiles that will actually be packed rather than the number of
 * cells, so a sparsely populated layer does not allocate staging buffers for
 * every empty cell of a large or infinite map.
 */
function estimateTileCapacity(layerData: ResolvedTileLayer): number {
  if (layerData.infinite && layerData.chunks) {
    let count = 0
    for (const chunk of layerData.chunks) count += countTiles(chunk.tiles)
    return count
  }

  return countTiles(layerData.tiles)
}

function countTiles(tiles: (ResolvedTile | null)[]): number {
  let count = 0
  for (const tile of tiles) {
    if (tile) count++
  }
  return count
}
