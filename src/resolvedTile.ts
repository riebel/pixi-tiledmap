import type { ResolvedTile, ResolvedTileset, TiledTileInput } from './types/index.js'
import {
  FLIPPED_DIAGONALLY_FLAG,
  FLIPPED_HORIZONTALLY_FLAG,
  FLIPPED_VERTICALLY_FLAG,
  GID_MASK
} from './types/index.js'

export function resolveTileInput(
  input: TiledTileInput,
  tilesets: ResolvedTileset[]
): ResolvedTile | null {
  if (input === null || input === 0) return null
  if (typeof input === 'number') return resolveTileGid(input, tilesets)
  if ('gid' in input && input.gid !== undefined) return resolveTileGid(input.gid, tilesets, input)
  if ('localId' in input || 'tileId' in input) return resolveLocalTile(input, tilesets)
  throw new Error('Tile input must include localId, tileId, or gid.')
}

export function resolveTileGid(
  rawGid: number | undefined,
  tilesets: ResolvedTileset[],
  flips?: {
    horizontalFlip?: boolean
    verticalFlip?: boolean
    diagonalFlip?: boolean
    alpha?: number
  }
): ResolvedTile | null {
  if (rawGid === undefined || rawGid === 0) return null

  const gid = rawGid & GID_MASK
  const tilesetIndex = findTilesetIndexForGid(gid, tilesets)
  if (tilesetIndex < 0) {
    throw new RangeError(`GID ${gid} does not match any tileset in this map.`)
  }

  const tileset = tilesets[tilesetIndex]!
  const tile: ResolvedTile = {
    gid,
    localId: gid - tileset.firstgid,
    tilesetIndex,
    horizontalFlip: flips?.horizontalFlip ?? (rawGid & FLIPPED_HORIZONTALLY_FLAG) !== 0,
    verticalFlip: flips?.verticalFlip ?? (rawGid & FLIPPED_VERTICALLY_FLAG) !== 0,
    diagonalFlip: flips?.diagonalFlip ?? (rawGid & FLIPPED_DIAGONALLY_FLAG) !== 0
  }
  const alpha = normalizeAlpha(flips?.alpha)
  if (alpha !== undefined) tile.alpha = alpha
  return tile
}

export function resolveLocalTile(
  input: Exclude<TiledTileInput, number | ResolvedTile | null>,
  tilesets: ResolvedTileset[]
): ResolvedTile {
  const tilesetIndex = findTilesetIndex(input.tileset, tilesets)
  const tileset = tilesets[tilesetIndex]!
  const localId = input.localId ?? input.tileId
  if (localId === undefined) throw new Error('Tile input must include localId, tileId, or gid.')
  if (localId < 0 || localId >= tileset.tilecount) {
    throw new RangeError(
      `Local tile ID ${localId} is outside tileset "${tileset.name}" (${tileset.tilecount} tiles).`
    )
  }
  const tile: ResolvedTile = {
    gid: tileset.firstgid + localId,
    localId,
    tilesetIndex,
    horizontalFlip: input.horizontalFlip ?? false,
    verticalFlip: input.verticalFlip ?? false,
    diagonalFlip: input.diagonalFlip ?? false
  }
  const alpha = normalizeAlpha(input.alpha)
  if (alpha !== undefined) tile.alpha = alpha
  return tile
}

export function findTilesetIndex(
  selector: string | number | undefined,
  tilesets: ResolvedTileset[]
): number {
  if (selector === undefined) {
    if (tilesets.length === 0) throw new Error('Cannot set a tile without tilesets.')
    return 0
  }
  if (typeof selector === 'number') {
    if (!tilesets[selector]) throw new RangeError(`Tileset index ${selector} not found.`)
    return selector
  }

  const index = tilesets.findIndex(
    (tileset) =>
      tileset.name === selector || tileset.source === selector || tileset.image === selector
  )
  if (index < 0) throw new Error(`Tileset "${selector}" not found.`)
  return index
}

function normalizeAlpha(alpha: number | undefined): number | undefined {
  if (alpha === undefined) return undefined
  if (!Number.isFinite(alpha)) throw new RangeError('Tile alpha must be a finite number.')
  return Math.min(1, Math.max(0, alpha))
}

export function findTilesetIndexForGid(
  gid: number,
  tilesets: Pick<ResolvedTileset, 'firstgid'>[]
): number {
  for (let i = tilesets.length - 1; i >= 0; i--) {
    const tileset = tilesets[i]
    if (tileset && tileset.firstgid <= gid) return i
  }
  return -1
}
