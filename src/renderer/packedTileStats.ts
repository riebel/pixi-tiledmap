/**
 * Internal renderer instrumentation.
 *
 * Deliberately not re-exported from `src/renderer/index.ts` or `src/index.ts`:
 * tests and benchmarks import this module directly so that runtime editing can
 * be asserted structurally (rebuild counts, slot reuse, buffer uploads) without
 * committing to a public debug API.
 *
 * Counters are plain number fields on a per-renderer object, so production cost
 * is a handful of increments and one small allocation per renderer.
 */

export interface PackedTileStats {
  /** Full tile-layer rebuilds: every render child destroyed and rebuilt. */
  fullRebuilds: number
  /** In-place edits of an existing quad (position and/or UV rewrite). */
  partialUpdates: number
  /** Inserts that recycled a slot previously released by a clear. */
  insertsIntoFreeSlot: number
  /** Inserts that consumed a fresh slot from existing batch capacity. */
  insertsIntoNewSlot: number
  /** Batch capacity reallocations (position/UV/index arrays regrown). */
  capacityGrowths: number
  /** Packed batches created, including those created after the initial build. */
  batchesCreated: number
  meshesCreated: number
  meshesDestroyed: number
  /** Geometry buffer `update()` calls, i.e. GPU re-uploads. */
  bufferUploads: number
}

export const packedTileStatsSymbol = Symbol('pixi-tiledmap.packedTileStats')

export function createPackedTileStats(): PackedTileStats {
  return {
    fullRebuilds: 0,
    partialUpdates: 0,
    insertsIntoFreeSlot: 0,
    insertsIntoNewSlot: 0,
    capacityGrowths: 0,
    batchesCreated: 0,
    meshesCreated: 0,
    meshesDestroyed: 0,
    bufferUploads: 0
  }
}

export interface PackedTileStatsOwner {
  readonly [packedTileStatsSymbol]: PackedTileStats
}

export function readPackedTileStats(owner: PackedTileStatsOwner): PackedTileStats {
  return owner[packedTileStatsSymbol]
}
