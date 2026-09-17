import { Container, Mesh, MeshGeometry, Texture, type TextureSource } from 'pixi.js'
import type { MapContext, ResolvedTile } from '../types'
import {
  createPackedTileStats,
  type PackedTileStats,
  packedTileStatsSymbol
} from './packedTileStats.js'
import { destroysChildren } from './renderableLayer.js'
import type { TileSetRenderer } from './TileSetRenderer.js'
import { writeMapTileBox } from './tileDrawPlan.js'
import { createTileSprite, hexTurnDegrees } from './tileSpriteFactory.js'

const DEFAULT_TILES_PER_MESH = 16_000
const MAX_TILES_PER_MESH = 16_383

// Caps how much slack a single growth step may add. Doubling alone would let a
// large batch jump by thousands of unused quads, and every quad in `positions`
// is copied by PixiJS' mesh batcher (BatchableMesh.attributeSize is
// positions.length / 2), so unused capacity is not free.
const MAX_CAPACITY_GROWTH_STEP = 1024

// Starting capacity of a batch opened only to keep draw order. Layers that mix
// tilesets under overlapping tiles can open one such batch per tile, so each
// starts small and grows like any other batch.
const ORDER_SPLIT_TILE_CAPACITY = 16

/**
 * Corner orders for the eight flip combinations, indexed by
 * `horizontal | vertical << 1 | diagonal << 2`. Precomputed so packing a tile
 * never allocates a per-tile order array.
 */
const UV_ORDERS: readonly (readonly [number, number, number, number])[] = [
  [0, 1, 2, 3], // none
  [1, 0, 3, 2], // horizontal
  [3, 2, 1, 0], // vertical
  [2, 3, 0, 1], // horizontal + vertical
  [0, 3, 2, 1], // diagonal
  [3, 0, 1, 2], // diagonal + horizontal
  [1, 2, 3, 0], // diagonal + vertical
  [2, 1, 0, 3] // diagonal + horizontal + vertical
]

interface PackedTileBatch {
  /** Position of this batch's mesh among the renderer's draw items. */
  order: number
  texture: Texture
  alpha: number
  positions: Float32Array
  uvs: Float32Array
  indices: Uint32Array
  /** Slot -> live handle. `null` marks a released (degenerate) slot. */
  handles: (InternalTileRenderHandle | null)[]
  /** Released slots available for reuse, LIFO. */
  freeSlots: number[]
  /** High-water mark of slots ever used; slots >= tileCount do not exist. */
  tileCount: number
  tileCapacity: number
  mesh: Mesh | null
}

const quadIndexCache = new Map<number, Uint32Array>()

export interface PackedTileRenderHandle {
  mesh: Mesh | null
  textureSource: TextureSource
  alpha: number
  x: number
  y: number
  width: number
  height: number
  uvKey?: number
  positionOffset: number
  uvOffset: number
}

/**
 * Internal handle shape. The extra fields are intentionally absent from the
 * public `PackedTileRenderHandle` type: they are renderer-owned bookkeeping and
 * every consumer re-validates them through `asInternalHandle` before use, so a
 * hand-built public handle still works through the foreign-handle fallbacks.
 */
interface InternalTileRenderHandle extends PackedTileRenderHandle {
  batch: PackedTileBatch
  slot: number
  released: boolean
}

/** The part of a quad or sprite placement the coverage grid reads. */
interface CoverageRect {
  x: number
  y: number
  width: number
  height: number
}

export interface PackedTextureRect {
  texture: Texture
  x: number
  y: number
  width: number
  height: number
  alpha?: number
  uvOrder?: readonly [number, number, number, number]
  uvKey?: number
}

export class PackedTileLayerRenderer extends Container {
  /** @internal Test/benchmark instrumentation; not part of the public API. */
  readonly [packedTileStatsSymbol]: PackedTileStats = createPackedTileStats()

  private readonly _batches = new Map<TextureSource, Map<number, PackedTileBatch[]>>()
  /**
   * Batches and tile sprites in draw order. Finalizing adds children in this
   * order; an item's index is its draw `order`.
   */
  private readonly _drawItems: (PackedTileBatch | Container)[] = []
  /**
   * Highest draw order covering each coverage cell. A quad must be drawn after
   * every earlier quad it overlaps, so it may only join a batch whose order is
   * at least the highest order under its footprint. Missing cells read as
   * order 0, so a layer that never leaves its first batch records nothing.
   */
  private readonly _coverage = new Map<number, number>()
  /**
   * The same record for quads and sprites that are not confined to their own
   * cell shape. Confined visuals of different cells never overlap, so a
   * confined visual only has to stay above these.
   */
  private readonly _looseCoverage = new Map<number, number>()
  /**
   * Whether `_coverage` is being kept. Only a visual that may leave its cell
   * shape reads it, so it is filled from the packed quads and sprites when the
   * first such visual arrives, and dropped again when the layer is finalized.
   */
  private _coverageTracked = false
  /** Where each tile sprite is drawn, for filling `_coverage` later. */
  private readonly _spriteRects = new Map<Container, CoverageRect>()
  private _coverageCellWidth = 0
  private _coverageCellHeight = 0
  private _coverageSlack = 0
  /**
   * Meshes and tile sprites this renderer created. Anything else among
   * `children` belongs to the caller and must survive a rebuild in place.
   */
  private readonly _ownChildren = new Set<Container>()
  /**
   * Where tile children go while none exist: the position the last ones held
   * before a reset, or the bottom when the layer has never had any, so caller
   * children sit above the tiles by default.
   */
  private _ownChildrenIndex = 0
  private readonly _initialTileCapacity: number
  private readonly _maxTilesPerMesh: number
  private _finalized = false

  /**
   * True while every packed quad is provably confined to its own grid cell.
   *
   * Quads are drawn in slot order within a mesh, but an incremental insert can
   * only ever append or recycle a slot - it cannot reproduce the render-order
   * traversal a full rebuild performs. Slot order is therefore only guaranteed
   * to be visually irrelevant when no two quads overlap, which is what this
   * flag tracks. When it is false, structural edits fall back to a rebuild so
   * layering stays identical to what a full rebuild produces.
   */
  private _quadsConfined = true

  constructor(initialTileCapacity = 256, maxTilesPerMesh = DEFAULT_TILES_PER_MESH) {
    super()
    this._maxTilesPerMesh = Math.max(1, Math.min(maxTilesPerMesh, MAX_TILES_PER_MESH))
    this._initialTileCapacity = Math.max(1, Math.min(initialTileCapacity, this._maxTilesPerMesh))
  }

  addTile(
    tile: ResolvedTile,
    tsRenderer: TileSetRenderer,
    x: number,
    y: number,
    ctx: MapContext
  ): PackedTileRenderHandle | null {
    this._useCoverageGrid(ctx)

    if (this._needsSpriteTile(tile, tsRenderer, ctx)) {
      const sprite = createTileSprite(tile, tsRenderer, x, y, ctx)
      if (!sprite) return null
      const rect = buildTileRect(tile, tsRenderer, x, y, ctx)
      if (!rect) {
        this._addSprite(sprite, null, false)
        return null
      }
      const ownCell = isTileInOwnCellShape(tile, rect, x, y, ctx)
      this._trackConfinement(ownCell, ctx)
      turnRectBounds(rect, hexTurnDegrees(tile, ctx.orientation))
      this._addSprite(sprite, rect, ownCell)
      return null
    }

    const rect = buildTileRect(tile, tsRenderer, x, y, ctx)
    if (!rect) return null

    const ownCell = isTileInOwnCellShape(tile, rect, x, y, ctx)
    this._trackConfinement(ownCell, ctx)
    return this._addRect(rect, ownCell)
  }

  /**
   * Incrementally packs a static tile into a previously empty cell.
   *
   * Returns `null` when the tile cannot be represented safely without a full
   * rebuild, in which case the caller must fall back to one.
   *
   * Deliberately protected: an internal seam for `TileLayerRenderer`, not
   * public API surface.
   */
  protected insertPackedTile(
    tile: ResolvedTile,
    tsRenderer: TileSetRenderer,
    x: number,
    y: number,
    ctx: MapContext
  ): PackedTileRenderHandle | null {
    if (!this._quadsConfined) return null
    if (this._needsSpriteTile(tile, tsRenderer, ctx)) return null

    const rect = buildTileRect(tile, tsRenderer, x, y, ctx)
    if (!rect) return null
    if (!isRectConfinedToCell(rect, x, y, ctx)) return null

    return this._addRect(rect, true)
  }

  finalize(): void {
    for (const item of this._drawItems) {
      if (item instanceof Container) this._addOwnChild(item)
      else this._materializeBatch(item)
    }
    this._finalized = true
    this._coverage.clear()
    this._coverageTracked = false
  }

  updatePackedTile(
    handle: PackedTileRenderHandle,
    tile: ResolvedTile,
    tsRenderer: TileSetRenderer,
    x: number,
    y: number,
    ctx: MapContext
  ): boolean {
    if (!handle.mesh || this._needsSpriteTile(tile, tsRenderer, ctx)) return false

    const rect = buildTileRect(tile, tsRenderer, x, y, ctx)
    if (!rect || !isSameBatchGroup(rect, handle)) return false

    const rectChanged = !isSameRect(rect, handle)
    // A quad moved or resized in place keeps its draw position, which is only
    // safe while no quad can overlap another.
    if (rectChanged && !this._canMoveInPlace(rect, x, y, ctx)) return false

    const geometry = handle.mesh.geometry
    const stats = this[packedTileStatsSymbol]
    let changed = false

    if (rectChanged) {
      writeRectPositions(
        geometry.positions,
        handle.positionOffset,
        rect.x,
        rect.y,
        rect.width,
        rect.height
      )
      geometry.getBuffer('aPosition').update()
      stats.bufferUploads++
      handle.x = rect.x
      handle.y = rect.y
      handle.width = rect.width
      handle.height = rect.height
      changed = true
    }

    if (rect.uvKey !== handle.uvKey) {
      writeTextureUvs(geometry.uvs, handle.uvOffset, rect.texture, rect.uvOrder)
      geometry.getBuffer('aUV').update()
      stats.bufferUploads++
      handle.uvKey = rect.uvKey
      changed = true
    }

    if (changed) stats.partialUpdates++
    return true
  }

  private _canMoveInPlace(rect: PackedTextureRect, x: number, y: number, ctx: MapContext): boolean {
    return this._quadsConfined && isRectConfinedToCell(rect, x, y, ctx)
  }

  addTextureRect(rect: PackedTextureRect): PackedTileRenderHandle {
    // Raw rectangles carry no grid-cell contract, so they can overlap freely.
    this._quadsConfined = false
    return this._addRect(rect, false)
  }

  clearPackedTile(handle: PackedTileRenderHandle): boolean {
    if (!handle.mesh) return false

    const internal = this._asInternalHandle(handle)
    if (!internal) {
      // Foreign handle: degenerate in place without recycling the slot.
      const geometry = handle.mesh.geometry
      geometry.positions.fill(0, handle.positionOffset, handle.positionOffset + 8)
      geometry.uvs.fill(0, handle.uvOffset, handle.uvOffset + 8)
      geometry.getBuffer('aPosition').update()
      geometry.getBuffer('aUV').update()
      this[packedTileStatsSymbol].bufferUploads += 2
      return true
    }

    const batch = internal.batch
    const offset = internal.slot * 8
    batch.positions.fill(0, offset, offset + 8)
    batch.uvs.fill(0, offset, offset + 8)

    internal.released = true
    internal.mesh = null
    batch.handles[internal.slot] = null
    batch.freeSlots.push(internal.slot)

    this._syncBatch(batch)
    return true
  }

  /**
   * Destroys all render children and drops packed batch state. Callers must
   * rebuild afterwards; the renderer is left in its pre-build shape.
   */
  protected resetPackedTiles(): void {
    for (const child of this._removeOwnChildren()) {
      if (child instanceof Mesh) this[packedTileStatsSymbol].meshesDestroyed++
      child.destroy()
    }
    this._releaseBatches(true)
    this._finalized = false
    this._quadsConfined = true
  }

  /**
   * Places a sprite-backed tile above everything added so far. Before the layer
   * is finalized it only takes its place in the draw order.
   */
  private _addSprite(sprite: Container, rect: PackedTextureRect | null, ownCell: boolean): void {
    const order = this._drawItems.length
    this._drawItems.push(sprite)
    if (rect) {
      this._spriteRects.set(sprite, {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      })
      this._recordCoverage(rect, order, ownCell)
    }
    if (this._finalized) this._addOwnChild(sprite)
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    // Container.destroy only destroys children when `options.children` is set;
    // otherwise it detaches them and the caller may keep them alive. Those
    // meshes still reference the batch texture, so it is only ours to destroy
    // when they go down with us.
    const destroyChildren = destroysChildren(options)
    const destroyTextures = typeof options === 'boolean' ? options : (options?.texture ?? false)
    super.destroy(options)
    this._ownChildren.clear()
    // Mesh.destroy() already destroys its texture when `texture` is requested.
    // Only reclaim the wrapper ourselves when Pixi left it intact.
    this._releaseBatches(destroyChildren && !destroyTextures)
  }

  private _addRect(rect: PackedTextureRect, ownCell: boolean): InternalTileRenderHandle {
    const alpha = rect.alpha ?? 1
    const batch = this._getBatch(rect.texture, alpha, this._coveredOrder(rect, ownCell))
    this._recordCoverage(rect, batch.order, ownCell)
    const slot = this._allocSlot(batch)
    const offset = slot * 8

    writeRectPositions(batch.positions, offset, rect.x, rect.y, rect.width, rect.height)
    writeTextureUvs(batch.uvs, offset, rect.texture, rect.uvOrder)

    const handle: InternalTileRenderHandle = {
      mesh: batch.mesh,
      textureSource: rect.texture.source,
      alpha,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      uvKey: rect.uvKey,
      positionOffset: offset,
      uvOffset: offset,
      batch,
      slot,
      released: false
    }
    batch.handles[slot] = handle

    if (this._finalized) {
      this._syncBatch(batch)
      handle.mesh = batch.mesh
    }
    return handle
  }

  private _allocSlot(batch: PackedTileBatch): number {
    const stats = this[packedTileStatsSymbol]

    // The initial build never releases slots, so only live edits can recycle.
    // A recycled slot sits between older quads, which only quads that cannot
    // overlap anything tolerate.
    if (this._finalized && this._quadsConfined) {
      const recycled = batch.freeSlots.pop()
      if (recycled !== undefined) {
        stats.insertsIntoFreeSlot++
        return recycled
      }
    }

    if (batch.tileCount >= batch.tileCapacity) {
      this._growBatch(batch, batch.tileCount + 1)
    }
    if (this._finalized) stats.insertsIntoNewSlot++
    return batch.tileCount++
  }

  /**
   * Grows a batch to hold at least `needed` quads. `_getBatch` guarantees the
   * batch still has room below `_maxTilesPerMesh` before this is called.
   */
  private _growBatch(batch: PackedTileBatch, needed: number): void {
    if (needed <= batch.tileCapacity) return

    const target = Math.min(
      this._maxTilesPerMesh,
      Math.max(
        needed,
        Math.min(batch.tileCapacity * 2, batch.tileCapacity + MAX_CAPACITY_GROWTH_STEP)
      )
    )

    const positions = new Float32Array(target * 8)
    positions.set(batch.positions)
    batch.positions = positions

    const uvs = new Float32Array(target * 8)
    uvs.set(batch.uvs)
    batch.uvs = uvs

    // Owned from here on: shared cached index arrays must never be mutated.
    batch.indices = buildQuadIndices(target)
    batch.tileCapacity = target
    this[packedTileStatsSymbol].capacityGrowths++
  }

  /** Pushes CPU-side batch data to the mesh, rebinding buffers after a growth. */
  private _syncBatch(batch: PackedTileBatch): void {
    const mesh = batch.mesh
    if (!mesh) {
      this._materializeBatch(batch)
      return
    }

    const geometry = mesh.geometry
    const stats = this[packedTileStatsSymbol]

    if (geometry.positions !== batch.positions) {
      geometry.positions = batch.positions
      geometry.uvs = batch.uvs
      geometry.indices = batch.indices
      stats.bufferUploads += 3
      return
    }

    geometry.getBuffer('aPosition').update()
    geometry.getBuffer('aUV').update()
    stats.bufferUploads += 2
  }

  private _materializeBatch(batch: PackedTileBatch): void {
    if (batch.mesh || batch.tileCount === 0) return

    this._trimBatch(batch)

    const geometry = new MeshGeometry({
      positions: batch.positions,
      uvs: batch.uvs,
      indices: batch.indices
    })
    geometry.batchMode = 'batch'

    const mesh = new Mesh({ geometry, texture: batch.texture })
    mesh.alpha = batch.alpha
    batch.mesh = mesh

    for (const handle of batch.handles) {
      if (handle) handle.mesh = mesh
    }

    this[packedTileStatsSymbol].meshesCreated++
    this._addOwnChild(mesh)
  }

  /**
   * Adds a tile child after the renderer's other tile children, so children the
   * caller placed above or below the tiles keep that position.
   */
  private _addOwnChild(child: Container): void {
    const children = this.children
    this._ownChildren.add(child)

    // Common case: every child is ours, so appending keeps the order.
    if (children.length === this._ownChildren.size - 1) {
      this.addChild(child)
      return
    }

    let index = children.length
    if (this._ownChildren.size === 1) {
      index = Math.min(this._ownChildrenIndex, index)
    } else {
      while (index > 0 && !this._ownChildren.has(children[index - 1]!)) index--
    }
    this.addChildAt(child, index)
  }

  /** Detaches this renderer's tile children and leaves caller children in place. */
  private _removeOwnChildren(): Container[] {
    const children = this.children
    const own = this._ownChildren
    if (children.length === own.size) {
      own.clear()
      return this.removeChildren()
    }

    const firstOwn = children.findIndex((child) => own.has(child))
    if (firstOwn < 0) {
      own.clear()
      return []
    }
    this._ownChildrenIndex = firstOwn

    const removed: Container[] = []
    if (firstOwn === 0) {
      // PixiJS 8 treats removeChildren's end index as a count, which is only
      // correct for a range starting at 0, so only the leading run uses it.
      let runEnd = 0
      while (runEnd < children.length && own.has(children[runEnd]!)) runEnd++
      removed.push(...this.removeChildren(0, runEnd))
    }
    for (const child of children.filter((candidate) => own.has(candidate))) {
      removed.push(this.removeChild(child))
    }

    own.clear()
    return removed
  }

  /**
   * Right-sizes a freshly built batch so a static layer keeps exactly the
   * geometry footprint it had before incremental editing existed.
   */
  private _trimBatch(batch: PackedTileBatch): void {
    if (batch.tileCapacity === batch.tileCount) return

    batch.positions = batch.positions.slice(0, batch.tileCount * 8)
    batch.uvs = batch.uvs.slice(0, batch.tileCount * 8)
    batch.indices = getQuadIndices(batch.tileCount)
    batch.tileCapacity = batch.tileCount
  }

  /** A batch with a freed slot, while slots may be recycled at all. */
  private _findRecyclableBatch(batches: PackedTileBatch[]): PackedTileBatch | undefined {
    if (!this._finalized || !this._quadsConfined) return undefined
    return batches.find((candidate) => candidate.freeSlots.length > 0)
  }

  private _hasRoom(batch: PackedTileBatch): boolean {
    return batch.tileCount < batch.tileCapacity || batch.tileCapacity < this._maxTilesPerMesh
  }

  /** Returns a batch for the texture and alpha whose draw order is at least `minOrder`. */
  private _getBatch(texture: Texture, alpha: number, minOrder: number): PackedTileBatch {
    const source = texture.source
    let batchesByAlpha = this._batches.get(source)
    if (!batchesByAlpha) {
      batchesByAlpha = new Map()
      this._batches.set(source, batchesByAlpha)
    }

    let batches = batchesByAlpha.get(alpha)
    if (!batches) {
      batches = []
      batchesByAlpha.set(alpha, batches)
    }

    const recyclable = this._findRecyclableBatch(batches)
    if (recyclable) return recyclable

    const last = batches[batches.length - 1]
    if (last && last.order >= minOrder && this._hasRoom(last)) return last

    // A group whose newest batch still has room only splits to keep draw order.
    const capacity =
      last && this._hasRoom(last)
        ? Math.min(this._initialTileCapacity, ORDER_SPLIT_TILE_CAPACITY)
        : this._initialTileCapacity
    const batch: PackedTileBatch = {
      order: this._drawItems.length,
      texture: new Texture({ source }),
      alpha,
      positions: new Float32Array(capacity * 8),
      uvs: new Float32Array(capacity * 8),
      indices: getQuadIndices(capacity),
      handles: [],
      freeSlots: [],
      tileCount: 0,
      tileCapacity: capacity,
      mesh: null
    }
    batches.push(batch)
    this._drawItems.push(batch)
    this[packedTileStatsSymbol].batchesCreated++
    return batch
  }

  private _releaseBatches(destroyTextures: boolean): void {
    for (const batchesByAlpha of this._batches.values()) {
      for (const batches of batchesByAlpha.values()) {
        for (const batch of batches) {
          // Batch-owned wrapper around a TileSetRenderer-owned source; the
          // default `destroy()` leaves the shared source untouched.
          if (destroyTextures) batch.texture.destroy()
          batch.mesh = null
          batch.handles.length = 0
          batch.freeSlots.length = 0
        }
      }
    }
    this._batches.clear()
    this._drawItems.length = 0
    this._coverage.clear()
    this._looseCoverage.clear()
    this._coverageTracked = false
    this._spriteRects.clear()
  }

  /**
   * Sizes coverage cells to the map grid on first use. The size never changes
   * afterwards, so every recorded footprint stays comparable.
   */
  private _useCoverageGrid(ctx: MapContext): void {
    if (this._coverageCellWidth > 0) return
    this._coverageCellWidth = ctx.tilewidth > 0 ? ctx.tilewidth : DEFAULT_COVERAGE_CELL
    this._coverageCellHeight = ctx.tileheight > 0 ? ctx.tileheight : DEFAULT_COVERAGE_CELL
    // Seam padding overlaps a neighbour by a sub-pixel strip no sample lands in.
    this._coverageSlack =
      ctx.orientation === 'orthogonal'
        ? Math.min(ctx.tileSpritePadding ?? 0, MAX_CONFINED_OVERHANG)
        : 0
  }

  /**
   * Highest draw order among the quads and sprites under `rect` that it may
   * overlap. While every visual is confined to its cell nothing can be under
   * it, and cells cleared by edits still hold their old order, so the grid is
   * not consulted. A visual confined to its own cell shape can only overlap
   * visuals that are not.
   */
  private _coveredOrder(rect: PackedTextureRect, ownCell: boolean): number {
    if (this._quadsConfined) return 0
    if (!ownCell) this._trackCoverage()
    const coverage = ownCell ? this._looseCoverage : this._coverage
    if (coverage.size === 0 || !this._setCoverageBounds(rect)) return 0
    return highestCoverage(coverage)
  }

  private _recordCoverage(rect: PackedTextureRect, order: number, ownCell: boolean): void {
    if (order === 0) return
    if (this._coverageTracked) this._raiseCoverage(this._coverage, rect, order)
    if (!ownCell) this._raiseCoverage(this._looseCoverage, rect, order)
  }

  /** Fills `_coverage` from every quad and sprite drawn above the first item. */
  private _trackCoverage(): void {
    if (this._coverageTracked) return
    this._coverageTracked = true
    const items = this._drawItems
    for (let order = 1; order < items.length; order++) {
      const item = items[order]!
      if (item instanceof Container) {
        const rect = this._spriteRects.get(item)
        if (rect) this._raiseCoverage(this._coverage, rect, order)
        continue
      }
      for (const handle of item.handles) {
        if (handle) this._raiseCoverage(this._coverage, handle, order)
      }
    }
  }

  private _raiseCoverage(coverage: Map<number, number>, rect: CoverageRect, order: number): void {
    if (!this._setCoverageBounds(rect)) return
    const { left, top, right, bottom } = _coverageBounds
    for (let row = top; row <= bottom; row++) {
      for (let col = left; col <= right; col++) {
        raiseCoverage(coverage, coverageKey(col, row), order)
      }
    }
  }

  /** Writes the coverage cells under `rect` to `_coverageBounds`; false when it covers none. */
  private _setCoverageBounds(rect: CoverageRect): boolean {
    if (this._coverageCellWidth === 0) {
      // Raw rectangles added before any tile: pick a grid and keep it.
      this._coverageCellWidth = DEFAULT_COVERAGE_CELL
      this._coverageCellHeight = DEFAULT_COVERAGE_CELL
    }

    const inset = this._coverageSlack + CONFINEMENT_EPSILON
    const left = rect.x + CONFINEMENT_EPSILON
    const top = rect.y + CONFINEMENT_EPSILON
    const right = rect.x + rect.width - inset
    const bottom = rect.y + rect.height - inset
    if (right <= left || bottom <= top) return false

    _coverageBounds.left = Math.floor(left / this._coverageCellWidth)
    _coverageBounds.top = Math.floor(top / this._coverageCellHeight)
    _coverageBounds.right = Math.floor(right / this._coverageCellWidth)
    _coverageBounds.bottom = Math.floor(bottom / this._coverageCellHeight)
    return true
  }

  private _asInternalHandle(handle: PackedTileRenderHandle): InternalTileRenderHandle | null {
    const candidate = handle as Partial<InternalTileRenderHandle>
    const batch = candidate.batch
    if (!batch || candidate.released !== false || typeof candidate.slot !== 'number') return null
    return batch.handles[candidate.slot] === handle ? (handle as InternalTileRenderHandle) : null
  }

  /**
   * Clears `_quadsConfined` for a visual that may leave its grid cell. On
   * orthogonal maps `ownCell` is exactly `isRectConfinedToCell`; elsewhere no
   * cell is a rectangle, so nothing counts as confined.
   */
  private _trackConfinement(ownCell: boolean, ctx: MapContext): void {
    if (!ownCell || ctx.orientation !== 'orthogonal') this._quadsConfined = false
  }

  /** Mirrors `needsMapTileVisual`, kept a method for the hot path. */
  private _needsSpriteTile(
    tile: ResolvedTile,
    tsRenderer: TileSetRenderer,
    ctx: MapContext
  ): boolean {
    const animation = tsRenderer.getAnimationFrames(tile.localId)
    if (animation && animation.length > 1) return true
    if (tsRenderer.getGifSource(tile.localId)) return true
    return ctx.orientation === 'hexagonal' && (tile.diagonalFlip || tile.rotatedHex120 === true)
  }
}

const DEFAULT_COVERAGE_CELL = 32
const COVERAGE_KEY_OFFSET = 2 ** 20
const COVERAGE_KEY_SPAN = 2 ** 21

// Reusable coverage cell range; callers read it before the next bounds query.
const _coverageBounds = { left: 0, top: 0, right: 0, bottom: 0 }

/** Highest order recorded in `coverage` within `_coverageBounds`; 0 when none. */
function highestCoverage(coverage: Map<number, number>): number {
  const { left, top, right, bottom } = _coverageBounds
  let order = 0
  for (let row = top; row <= bottom; row++) {
    for (let col = left; col <= right; col++) {
      const covered = coverage.get(coverageKey(col, row))
      if (covered !== undefined && covered > order) order = covered
    }
  }
  return order
}

function raiseCoverage(coverage: Map<number, number>, key: number, order: number): void {
  const covered = coverage.get(key)
  if (covered === undefined || covered < order) coverage.set(key, order)
}

/** Packs a coverage cell into one safe integer; cells stay within +-2^20. */
function coverageKey(col: number, row: number): number {
  return (col + COVERAGE_KEY_OFFSET) * COVERAGE_KEY_SPAN + (row + COVERAGE_KEY_OFFSET)
}

// Reusable output rect - avoids allocating one per packed tile. Safe because
// every caller reads the fields before the next buildTileRect call, mirroring
// the reusable TilePosition in mapGeometry.ts.
const _tileRect: PackedTextureRect = {
  texture: Texture.EMPTY,
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  alpha: 1,
  uvOrder: UV_ORDERS[0],
  uvKey: 0
}

function buildTileRect(
  tile: ResolvedTile,
  tsRenderer: TileSetRenderer,
  x: number,
  y: number,
  ctx: MapContext
): PackedTextureRect | null {
  const texture = tsRenderer.getTexture(tile.localId)
  if (!texture) return null

  const flip = getTileFlipIndex(tile)
  const tileset = tsRenderer.tileset

  _tileRect.texture = texture
  if (tileset.tilerendersize === 'grid' || tile.diagonalFlip) {
    writeMapTileBox(_tileRect, tile, tsRenderer, x, y, ctx)
  } else {
    // The common case, inlined: a tile drawn at its own size and not turned.
    const renderW = tsRenderer.getRenderWidth(tile.localId, ctx)
    const renderH = tsRenderer.getRenderHeight(tile.localId, ctx)
    const padding = getTileMeshPadding(renderW, renderH, ctx)
    _tileRect.x = x + tileset.tileoffset.x
    _tileRect.y = y + tileset.tileoffset.y + ctx.tileheight - renderH
    _tileRect.width = renderW + padding
    _tileRect.height = renderH + padding
  }
  _tileRect.alpha = tile.alpha
  _tileRect.uvOrder = UV_ORDERS[flip]
  _tileRect.uvKey = tile.localId * 8 + flip
  return _tileRect
}

/**
 * Slack for the confinement comparison. The rect edge is computed as
 * `x + (size + padding)` while the cell edge is `x + size + padding`, and those
 * two groupings do not always round to the same double (e.g. 32 + 16.01 vs
 * 48 + 0.01). A 1e-6px window is orders of magnitude below anything visible and
 * far above the ~1e-11 ulp of realistic map coordinates.
 */
const CONFINEMENT_EPSILON = 1e-6

/**
 * Largest seam overhang that may still count as confined.
 *
 * `tileSpritePadding` widens a grid-sized quad past its cell, so padded
 * neighbours genuinely overlap and their draw order is genuinely significant.
 * That is only unobservable while the overlap stays far below one pixel: no
 * rasterisation sample falls inside such a strip. `tileSpritePadding` is a
 * public option with no upper bound, so a large value must not be waved through
 * as "confined" - at 4px the overlap is plainly visible and an appended quad
 * would cover a neighbour the render-order rebuild draws on top. Anything above
 * this bound falls back to a rebuild.
 */
const MAX_CONFINED_OVERHANG = 0.125

/**
 * Whether a tile quad stays inside its own grid cell, so that its draw order
 * relative to other quads cannot matter. Orthogonal cells tile the plane
 * exactly; a sub-pixel seam overhang is the only tolerated excursion.
 */
function isRectConfinedToCell(
  rect: PackedTextureRect,
  cellX: number,
  cellY: number,
  ctx: MapContext
): boolean {
  if (ctx.orientation !== 'orthogonal') return false
  const overhang = Math.min(ctx.tileSpritePadding ?? 0, MAX_CONFINED_OVERHANG)
  return isRectWithinCell(rect, cellX, cellY, ctx, overhang)
}

/** Whether `rect` stays inside the grid box at (`cellX`, `cellY`) plus `overhang`. */
function isRectWithinCell(
  rect: PackedTextureRect,
  cellX: number,
  cellY: number,
  ctx: MapContext,
  overhang: number
): boolean {
  const tolerance = overhang + CONFINEMENT_EPSILON
  return (
    rect.x >= cellX - CONFINEMENT_EPSILON &&
    rect.y >= cellY - CONFINEMENT_EPSILON &&
    rect.x + rect.width <= cellX + ctx.tilewidth + tolerance &&
    rect.y + rect.height <= cellY + ctx.tileheight + tolerance
  )
}

/**
 * Whether a tile's visible content stays inside its own cell shape, so it
 * cannot overlap the content of another tile that does the same.
 *
 * Orthogonal cells are rectangles; seam padding only counts up to
 * `MAX_CONFINED_OVERHANG`, since a wider overhang is visible and its order
 * matters. Isometric, staggered and hexagonal cells are diamonds and hexagons
 * whose bounding boxes overlap their neighbours'; a tile drawn exactly over
 * that box is taken to fill the cell shape, as grid-sized tile art for those
 * maps does. A hexagonal tile turned by 60 or 120 degrees no longer fits its
 * hexagon, so it is never taken as confined.
 *
 * Oblique maps draw unsheared tiles at sheared positions. With only one of
 * `skewx` and `skewy` set, grid-sized tiles still tile the plane: a row (or
 * column) is shifted as a whole. With both set, neighbours overlap.
 */
function isTileInOwnCellShape(
  tile: ResolvedTile,
  rect: PackedTextureRect,
  cellX: number,
  cellY: number,
  ctx: MapContext
): boolean {
  switch (ctx.orientation) {
    case 'orthogonal':
      return isRectConfinedToCell(rect, cellX, cellY, ctx)
    case 'oblique':
      return (!ctx.skewx || !ctx.skewy) && isRectOnCellBox(rect, cellX, cellY, ctx)
    case 'hexagonal':
      if (tile.diagonalFlip || tile.rotatedHex120 === true) return false
      return isRectOnCellBox(rect, cellX, cellY, ctx)
    default:
      return isRectOnCellBox(rect, cellX, cellY, ctx)
  }
}

/** Whether a tile is drawn exactly over its cell's box: grid-sized, without offset. */
function isRectOnCellBox(
  rect: PackedTextureRect,
  cellX: number,
  cellY: number,
  ctx: MapContext
): boolean {
  return isRectWithinCell(rect, cellX, cellY, ctx, 0) && isRectCellSized(rect, ctx)
}

function isRectCellSized(rect: PackedTextureRect, ctx: MapContext): boolean {
  return (
    rect.width >= ctx.tilewidth - CONFINEMENT_EPSILON &&
    rect.height >= ctx.tileheight - CONFINEMENT_EPSILON
  )
}

/** Widens `rect` in place to the bounds of its content turned around its center. */
function turnRectBounds(rect: PackedTextureRect, degrees: number): void {
  if (degrees === 0) return
  const radians = (degrees * Math.PI) / 180
  const cos = Math.abs(Math.cos(radians))
  const sin = Math.abs(Math.sin(radians))
  const width = rect.width * cos + rect.height * sin
  const height = rect.width * sin + rect.height * cos
  rect.x += (rect.width - width) / 2
  rect.y += (rect.height - height) / 2
  rect.width = width
  rect.height = height
}

function isSameBatchGroup(rect: PackedTextureRect, handle: PackedTileRenderHandle): boolean {
  return rect.texture.source === handle.textureSource && (rect.alpha ?? 1) === handle.alpha
}

function isSameRect(rect: PackedTextureRect, handle: PackedTileRenderHandle): boolean {
  return (
    rect.x === handle.x &&
    rect.y === handle.y &&
    rect.width === handle.width &&
    rect.height === handle.height
  )
}

function writeRectPositions(
  positions: Float32Array,
  offset: number,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  const right = x + width
  const bottom = y + height

  positions[offset] = x
  positions[offset + 1] = y
  positions[offset + 2] = right
  positions[offset + 3] = y
  positions[offset + 4] = right
  positions[offset + 5] = bottom
  positions[offset + 6] = x
  positions[offset + 7] = bottom
}

function buildQuadIndices(tileCount: number): Uint32Array {
  const indices = new Uint32Array(tileCount * 6)
  for (let index = 0, vertex = 0; index < indices.length; index += 6, vertex += 4) {
    indices[index] = vertex
    indices[index + 1] = vertex + 1
    indices[index + 2] = vertex + 2
    indices[index + 3] = vertex
    indices[index + 4] = vertex + 2
    indices[index + 5] = vertex + 3
  }
  return indices
}

/**
 * Shared, immutable index arrays for fully packed batches. Only ever handed to
 * batches that will not mutate them; growth allocates an owned copy instead.
 */
function getQuadIndices(tileCount: number): Uint32Array {
  let indices = quadIndexCache.get(tileCount)
  if (indices) return indices

  indices = buildQuadIndices(tileCount)
  quadIndexCache.set(tileCount, indices)
  return indices
}

function getTileMeshPadding(renderW: number, renderH: number, ctx: MapContext): number {
  if (ctx.orientation !== 'orthogonal') return 0
  if (renderW !== ctx.tilewidth || renderH !== ctx.tileheight) return 0
  return ctx.tileSpritePadding ?? 0
}

function writeTextureUvs(
  uvs: Float32Array,
  offset: number,
  texture: Texture,
  uvOrder: readonly [number, number, number, number] = UV_ORDERS[0]!
): void {
  const source = texture.uvs
  const corners = _uvCorners
  corners[0] = source.x0
  corners[1] = source.y0
  corners[2] = source.x1
  corners[3] = source.y1
  corners[4] = source.x2
  corners[5] = source.y2
  corners[6] = source.x3
  corners[7] = source.y3

  for (let i = 0; i < 4; i++) {
    const corner = uvOrder[i]! * 2
    uvs[offset++] = corners[corner]!
    uvs[offset++] = corners[corner + 1]!
  }
}

// Reusable corner scratch for writeTextureUvs, so packing a tile never allocates.
// A Float64Array keeps the values exact until they are written to the Float32 target.
const _uvCorners = new Float64Array(8)

function getTileFlipIndex(tile: ResolvedTile): number {
  return (tile.horizontalFlip ? 1 : 0) + (tile.verticalFlip ? 2 : 0) + (tile.diagonalFlip ? 4 : 0)
}
