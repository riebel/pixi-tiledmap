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

export function writeMapTileDrawRect(
  out: MapTileDrawRect,
  tile: ResolvedTile,
  tsRenderer: TileSetRenderer,
  x: number,
  y: number,
  ctx: MapContext
): MapTileDrawRect {
  const renderW = tsRenderer.getRenderWidth(tile.localId, ctx)
  const renderH = tsRenderer.getRenderHeight(tile.localId, ctx)
  const padding = getMapTilePadding(renderW, renderH, ctx)
  const tileOffset = tsRenderer.tileset.tileoffset

  out.x = x + tileOffset.x
  out.y = y + tileOffset.y + ctx.tileheight - renderH
  out.width = renderW + padding
  out.height = renderH + padding
  out.alpha = tile.alpha ?? 1
  return out
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
