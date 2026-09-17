import type { MapContext, ResolvedTile } from '../types'
import type { TileSetRenderer } from './TileSetRenderer.js'

export interface MapTileDrawRect {
  x: number
  y: number
  width: number
  height: number
  alpha: number
}

export function getMapTileDrawRect(
  tile: ResolvedTile,
  tsRenderer: TileSetRenderer,
  x: number,
  y: number,
  ctx: MapContext
): MapTileDrawRect {
  return writeMapTileDrawRect(
    { x: 0, y: 0, width: 0, height: 0, alpha: 1 },
    tile,
    tsRenderer,
    x,
    y,
    ctx
  )
}

function writeMapTileDrawRect(
  out: MapTileDrawRect,
  tile: ResolvedTile,
  tsRenderer: TileSetRenderer,
  x: number,
  y: number,
  ctx: MapContext
): MapTileDrawRect {
  writeMapTileBox(out, tile, tsRenderer, x, y, ctx)
  out.alpha = tile.alpha ?? 1
  return out
}

export interface TileBox {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Writes the screen rectangle a map tile covers, following Tiled's
 * `CellRenderer`: the tile is drawn into a box anchored at the bottom-left of
 * its cell - the grid cell for `tilerendersize: 'grid'`, else the tile's own
 * size - with the image centered in that box, the tile offset scaled with the
 * image, and a diagonally flipped tile's box transposed about its bottom-left.
 *
 * Seam padding is included. Hot path: no allocation.
 */
export function writeMapTileBox(
  out: TileBox,
  tile: ResolvedTile,
  tsRenderer: TileSetRenderer,
  x: number,
  y: number,
  ctx: MapContext
): void {
  const tileset = tsRenderer.tileset
  const localId = tile.localId
  const drawW = tsRenderer.getRenderWidth(localId, ctx)
  const drawH = tsRenderer.getRenderHeight(localId, ctx)
  const padding = getMapTilePadding(drawW, drawH, ctx)
  const grid = tileset.tilerendersize === 'grid'

  if (grid) {
    writeGridTileOrigin(out, tsRenderer, localId, x, y, drawW, drawH, ctx)
  } else {
    // Drawn at its own size, a tile fills its box and its offset is unscaled.
    out.x = x + tileset.tileoffset.x
    out.y = y + tileset.tileoffset.y + ctx.tileheight - drawH
  }
  out.width = drawW + padding
  out.height = drawH + padding

  // Tiled rotates a hexagonal tile's diagonal flag by 60 degrees instead; the
  // renderer keeps treating it as a transpose there.
  if (tile.diagonalFlip && drawW !== drawH && ctx.orientation !== 'hexagonal') {
    const halfDiff = grid ? (ctx.tileheight - ctx.tilewidth) / 2 : (drawH - drawW) / 2
    out.x += (drawW - drawH) / 2 + halfDiff
    out.y += (drawH - drawW) / 2 + halfDiff
    out.width = drawH + padding
    out.height = drawW + padding
  }
}

/** A grid-sized box: the fitted image is centered and its offset scaled with it. */
function writeGridTileOrigin(
  out: TileBox,
  tsRenderer: TileSetRenderer,
  localId: number,
  x: number,
  y: number,
  drawW: number,
  drawH: number,
  ctx: MapContext
): void {
  const offset = tsRenderer.tileset.tileoffset
  out.x = x + (ctx.tilewidth - drawW) / 2
  out.y = y + (ctx.tileheight - drawH) / 2
  if (offset.x !== 0) out.x += offset.x * scaleOf(drawW, tsRenderer.getTileWidth(localId))
  if (offset.y !== 0) out.y += offset.y * scaleOf(drawH, tsRenderer.getTileHeight(localId))
}

function scaleOf(drawn: number, intrinsic: number): number {
  return intrinsic > 0 ? drawn / intrinsic : 1
}

export function needsMapTileVisual(tile: ResolvedTile, tsRenderer: TileSetRenderer): boolean {
  const animation = tsRenderer.getAnimationFrames(tile.localId)
  if (animation && animation.length > 1) return true
  return !!tsRenderer.getGifSource(tile.localId)
}

export function getTileUvOrder(tile: ResolvedTile): [number, number, number, number] {
  const h = tile.horizontalFlip
  const v = tile.verticalFlip
  const d = tile.diagonalFlip

  if (d) {
    if (h && v) return [2, 1, 0, 3]
    if (h) return [3, 0, 1, 2]
    if (v) return [1, 2, 3, 0]
    return [0, 3, 2, 1]
  }

  if (h && v) return [2, 3, 0, 1]
  if (h) return [1, 0, 3, 2]
  if (v) return [3, 2, 1, 0]
  return [0, 1, 2, 3]
}

export function getTileUvKey(tile: ResolvedTile): number {
  return (
    tile.localId * 8 +
    (tile.horizontalFlip ? 1 : 0) +
    (tile.verticalFlip ? 2 : 0) +
    (tile.diagonalFlip ? 4 : 0)
  )
}

function getMapTilePadding(renderW: number, renderH: number, ctx: MapContext): number {
  if (ctx.orientation !== 'orthogonal') return 0
  if (renderW !== ctx.tilewidth || renderH !== ctx.tileheight) return 0
  return ctx.tileSpritePadding ?? 0
}
