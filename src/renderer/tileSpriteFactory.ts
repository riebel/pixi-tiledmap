import { AnimatedSprite, Sprite, type Texture } from 'pixi.js'
import { GifSprite } from 'pixi.js/gif'
import type { MapContext, ResolvedTile } from '../types'
import type { TileSetRenderer } from './TileSetRenderer.js'

export interface TileSpritePlacement {
  x: number
  y: number
}

export interface TileObjectPlacement extends TileSpritePlacement {
  width: number
  height: number
  rotation: number
  visible: boolean
}

export type TileVisualRequest =
  | {
      kind: 'map'
      tile: ResolvedTile
      tsRenderer: TileSetRenderer
      placement: TileSpritePlacement
      ctx: MapContext
    }
  | {
      kind: 'object'
      tile: ResolvedTile
      tsRenderer: TileSetRenderer
      placement: TileObjectPlacement
    }

export function createTileSprite(
  tile: ResolvedTile,
  tsRenderer: TileSetRenderer,
  px: number,
  py: number,
  ctx: MapContext
): Sprite | null {
  return createMapTileVisualAt(tile, tsRenderer, px, py, ctx)
}

export function createMapTileSprite(
  tile: ResolvedTile,
  tsRenderer: TileSetRenderer,
  placement: TileSpritePlacement,
  ctx: MapContext
): Sprite | null {
  return createMapTileVisualAt(tile, tsRenderer, placement.x, placement.y, ctx)
}

export function createTileVisual(request: TileVisualRequest): Sprite | null {
  return request.kind === 'map' ? createMapTileVisual(request) : createObjectTileVisual(request)
}

function createMapTileVisual(request: Extract<TileVisualRequest, { kind: 'map' }>): Sprite | null {
  const { tile, tsRenderer, placement, ctx } = request
  return createMapTileVisualAt(tile, tsRenderer, placement.x, placement.y, ctx)
}

function createMapTileVisualAt(
  tile: ResolvedTile,
  tsRenderer: TileSetRenderer,
  x: number,
  y: number,
  ctx: MapContext
): Sprite | null {
  const offset = tsRenderer.tileset.tileoffset
  const animFrames = tsRenderer.getAnimationFrames(tile.localId)

  if (animFrames && animFrames.length > 1) {
    const textures: { texture: Texture; time: number }[] = []
    for (const frame of animFrames) {
      const tex = tsRenderer.getTexture(frame.tileid)
      if (!tex) return null
      textures.push({ texture: tex, time: frame.duration })
    }
    const renderW = tsRenderer.getRenderWidth(tile.localId, ctx)
    const renderH = tsRenderer.getRenderHeight(tile.localId, ctx)
    const padding = getTileSpritePadding(renderW, renderH, ctx)
    const sprite = new AnimatedSprite(textures)
    sprite.width = renderW + padding
    sprite.height = renderH + padding
    sprite.position.set(x + offset.x, y + offset.y + ctx.tileheight - renderH)
    sprite.play()
    applyFlip(sprite, tile)
    return sprite
  }

  const texture = tsRenderer.getTexture(tile.localId)
  if (!texture) return null

  const gifSource = tsRenderer.getGifSource(tile.localId)
  const renderW = tsRenderer.getRenderWidth(tile.localId, ctx)
  const renderH = tsRenderer.getRenderHeight(tile.localId, ctx)
  const padding = getTileSpritePadding(renderW, renderH, ctx)
  const sprite = gifSource ? new GifSprite({ source: gifSource }) : new Sprite(texture)
  sprite.width = renderW + padding
  sprite.height = renderH + padding
  sprite.position.set(x + offset.x, y + offset.y + ctx.tileheight - renderH)
  applyFlip(sprite, tile)
  return sprite
}

export function createObjectTileSprite(
  tile: ResolvedTile,
  tsRenderer: TileSetRenderer,
  placement: TileObjectPlacement
): Sprite | null {
  return createTileVisual({ kind: 'object', tile, tsRenderer, placement })
}

function createObjectTileVisual(
  request: Extract<TileVisualRequest, { kind: 'object' }>
): Sprite | null {
  const { tile, tsRenderer, placement } = request
  const texture = tsRenderer.getTexture(tile.localId)
  if (!texture) return null

  const gifSource = tsRenderer.getGifSource(tile.localId)
  const sprite = gifSource ? new GifSprite({ source: gifSource }) : new Sprite(texture)
  const offset = tsRenderer.tileset.tileoffset
  const sized = fitObjectTileSize(tsRenderer, tile.localId, placement.width, placement.height)
  sprite.width = sized.width
  sprite.height = sized.height
  sprite.position.set(placement.x + offset.x, placement.y - sized.height + offset.y)
  sprite.angle = placement.rotation
  sprite.visible = placement.visible
  applyFlip(sprite, tile)

  return sprite
}

export function fitObjectTileSize(
  tsRenderer: TileSetRenderer,
  localId: number,
  objWidth: number,
  objHeight: number
): { width: number; height: number } {
  if (objWidth <= 0 || objHeight <= 0) {
    return tsRenderer.getTileSize(localId)
  }
  if (tsRenderer.tileset.fillmode !== 'preserve-aspect-fit') {
    return { width: objWidth, height: objHeight }
  }
  const intrinsic = tsRenderer.getTileSize(localId)
  if (intrinsic.width === 0 || intrinsic.height === 0) {
    return { width: objWidth, height: objHeight }
  }
  const scale = Math.min(objWidth / intrinsic.width, objHeight / intrinsic.height)
  return { width: intrinsic.width * scale, height: intrinsic.height * scale }
}

export function applyFlip(sprite: Sprite, tile: ResolvedTile): void {
  if (tile.diagonalFlip) {
    // Tiled encodes rotations via the diagonal (anti-diagonal) flip bit combined
    // with H/V bits. For all diagonal cases rotation is PI/2 (CW); the anchor and
    // scale vary by H/V to produce the four distinct transforms:
    //   D      → transpose     anchor(0,0) scale( 1,−1)
    //   D+H    → 90° CW        anchor(0,1) scale( 1, 1)
    //   D+V    → 90° CCW       anchor(1,0) scale(−1,−1)
    //   D+H+V  → 270° CW       anchor(1,1) scale(−1, 1)
    sprite.rotation += Math.PI / 2
    sprite.scale.x = tile.verticalFlip ? -1 : 1
    sprite.scale.y = tile.horizontalFlip ? 1 : -1
    sprite.anchor.set(tile.verticalFlip ? 1 : 0, tile.horizontalFlip ? 1 : 0)
  } else {
    if (tile.horizontalFlip) {
      sprite.scale.x = -1
      sprite.anchor.x = 1
    }
    if (tile.verticalFlip) {
      sprite.scale.y = -1
      sprite.anchor.y = 1
    }
  }
}

function getTileSpritePadding(renderW: number, renderH: number, ctx: MapContext): number {
  if (ctx.orientation !== 'orthogonal') return 0
  if (renderW !== ctx.tilewidth || renderH !== ctx.tileheight) return 0
  return ctx.tileSpritePadding ?? 0
}
