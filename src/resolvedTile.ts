import type { ResolvedTile, ResolvedTileset, TiledTileInput } from './types/index.js'
import {
  FLIPPED_DIAGONALLY_FLAG,
  FLIPPED_HORIZONTALLY_FLAG,
  FLIPPED_VERTICALLY_FLAG,
  GID_MASK,
  ROTATED_HEXAGONAL_120_FLAG
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
  options?: {
    horizontalFlip?: boolean
    verticalFlip?: boolean
    diagonalFlip?: boolean
    rotatedHex120?: boolean
    alpha?: number
    missingTileset?: 'throw' | 'null' | 'decoded'
  }
): ResolvedTile | null {
  if (rawGid === undefined || rawGid === 0) return null

  const decoded = decodeTileGid(rawGid)
  if (!decoded) return null

  const tilesetIndex = findTilesetIndexForGid(decoded.gid, tilesets)
  if (tilesetIndex < 0) {
    switch (options?.missingTileset) {
      case 'null':
        return null
      case 'decoded':
        return decoded
      default:
        throw new RangeError(`GID ${decoded.gid} does not match any tileset in this map.`)
    }
  }

  const tileset = tilesets[tilesetIndex]!
  const tile: ResolvedTile = {
    gid: decoded.gid,
    localId: decoded.gid - tileset.firstgid,
    tilesetIndex,
    horizontalFlip: options?.horizontalFlip ?? decoded.horizontalFlip,
    verticalFlip: options?.verticalFlip ?? decoded.verticalFlip,
    diagonalFlip: options?.diagonalFlip ?? decoded.diagonalFlip
  }
  return applyTileExtras(tile, {
    rotatedHex120: options?.rotatedHex120 ?? decoded.rotatedHex120,
    alpha: options?.alpha
  })
}

/**
 * Applies the tile fields that are only present when set, shared by both
 * resolution paths: the hexagonal rotation bit and the runtime alpha.
 *
 * They stay absent rather than defaulted so a tile without them compares equal
 * to a plain three-flag tile literal.
 */
function applyTileExtras(
  tile: ResolvedTile,
  extras: { rotatedHex120?: boolean; alpha?: number }
): ResolvedTile {
  if (extras.rotatedHex120) tile.rotatedHex120 = true
  const alpha = normalizeAlpha(extras.alpha)
  if (alpha !== undefined) tile.alpha = alpha
  return tile
}

export function decodeTileGid(rawGid: number): ResolvedTile | null {
  const gid = rawGid & GID_MASK
  if (gid === 0) return null

  const tile: ResolvedTile = {
    gid,
    localId: 0,
    tilesetIndex: 0,
    horizontalFlip: (rawGid & FLIPPED_HORIZONTALLY_FLAG) !== 0,
    verticalFlip: (rawGid & FLIPPED_VERTICALLY_FLAG) !== 0,
    diagonalFlip: (rawGid & FLIPPED_DIAGONALLY_FLAG) !== 0
  }
  // Set only when present, so tiles without it keep comparing equal to plain
  // three-flag tile literals.
  if ((rawGid & ROTATED_HEXAGONAL_120_FLAG) !== 0) tile.rotatedHex120 = true
  return tile
}

function resolveLocalTile(
  input: Exclude<TiledTileInput, number | ResolvedTile | null>,
  tilesets: ResolvedTileset[]
): ResolvedTile {
  const tilesetIndex = findTilesetIndex(input.tileset, tilesets)
  const tileset = tilesets[tilesetIndex]!
  const localId = resolveLocalId(input, tileset)

  return applyTileExtras(
    {
      gid: tileset.firstgid + localId,
      localId,
      tilesetIndex,
      horizontalFlip: input.horizontalFlip ?? false,
      verticalFlip: input.verticalFlip ?? false,
      diagonalFlip: input.diagonalFlip ?? false
    },
    input
  )
}

function resolveLocalId(
  input: Exclude<TiledTileInput, number | ResolvedTile | null>,
  tileset: ResolvedTileset
): number {
  const localId = input.localId ?? input.tileId
  if (localId === undefined) throw new Error('Tile input must include localId, tileId, or gid.')
  if (localId < 0 || localId >= tileset.tilecount) {
    throw new RangeError(
      `Local tile ID ${localId} is outside tileset "${tileset.name}" (${tileset.tilecount} tiles).`
    )
  }
  return localId
}

function findTilesetIndex(
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

function findTilesetIndexForGid(
  gid: number,
  tilesets: Pick<ResolvedTileset, 'firstgid'>[]
): number {
  for (let i = tilesets.length - 1; i >= 0; i--) {
    const tileset = tilesets[i]
    if (tileset && tileset.firstgid <= gid) return i
  }
  return -1
}
