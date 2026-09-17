import { AnimatedSprite, Sprite, type Texture } from 'pixi.js'
import { type GifSource, GifSprite } from 'pixi.js/gif'
import type { MapContext, ResolvedTile, TiledObjectAlignment } from '../types'
import type { TileSetRenderer } from './TileSetRenderer.js'
import { getMapTileDrawRect } from './tileDrawPlan.js'

/**
 * A `GifSprite` that never destroys its source. The source belongs to the
 * `Assets` cache or to the caller that supplied it, and other maps may share it.
 * `GifSprite.destroy` would otherwise destroy it for any truthy argument,
 * including the options object `Container.destroy({ children: true })` passes on.
 */
class SharedSourceGifSprite extends GifSprite {
  override destroy(): void {
    super.destroy(false)
  }
}

export function createGifSprite(source: GifSource): GifSprite {
  return new SharedSourceGifSprite({ source })
}

export interface TileSpritePlacement {
  x: number
  y: number
}

export interface TileObjectPlacement extends TileSpritePlacement {
  width: number
  height: number
  rotation: number
  visible: boolean
  /** Object opacity; multiplies the tile's own alpha. */
  opacity?: number
  /** Decides the default alignment of tile objects. */
  orientation?: MapContext['orientation']
}

export function createTileSprite(
  tile: ResolvedTile,
  tsRenderer: TileSetRenderer,
  px: number,
  py: number,
  ctx: MapContext
): Sprite | null {
  const sprite = createTileVisual(tile, tsRenderer)
  if (!sprite) return null

  const rect = getMapTileDrawRect(tile, tsRenderer, px, py, ctx)
  sprite.position.set(rect.x, rect.y)
  sprite.alpha = rect.alpha
  applyFlip(sprite, tile, rect.width, rect.height)
  return sprite
}

/**
 * A tile object, placed the way Tiled's renderers place it: the object box is
 * aligned to the object's origin by the tileset's `objectalignment`, the image
 * is centered in that box, and the whole object rotates around its origin.
 */
export function createObjectTileSprite(
  tile: ResolvedTile,
  tsRenderer: TileSetRenderer,
  placement: TileObjectPlacement
): Sprite | null {
  const sprite = createTileVisual(tile, tsRenderer)
  if (!sprite) return null

  const localId = tile.localId
  const tileW = tsRenderer.getTileWidth(localId)
  const tileH = tsRenderer.getTileHeight(localId)
  const hasSize = placement.width > 0 && placement.height > 0
  const boxW = hasSize ? placement.width : tileW
  const boxH = hasSize ? placement.height : tileH

  let scaleX = tileW > 0 ? boxW / tileW : 1
  let scaleY = tileH > 0 ? boxH / tileH : 1
  if (tsRenderer.tileset.fillmode === 'preserve-aspect-fit') {
    scaleX = scaleY = Math.min(scaleX, scaleY)
  }
  const drawW = tileW * scaleX
  const drawH = tileH * scaleY

  const [alignX, alignY] = alignmentFactors(
    tsRenderer.tileset.objectalignment,
    placement.orientation
  )
  const offset = tsRenderer.tileset.tileoffset
  let centerX = (0.5 - alignX) * boxW + offset.x * scaleX
  let centerY = (0.5 - alignY) * boxH + offset.y * scaleY
  let width = drawW
  let height = drawH
  if (tile.diagonalFlip && placement.orientation !== 'hexagonal') {
    const halfDiff = (boxH - boxW) / 2
    centerX += halfDiff
    centerY += halfDiff
    width = drawH
    height = drawW
  }

  // Top-left of the drawn box relative to the object origin, then rotated
  // around that origin.
  const localX = centerX - width / 2
  const localY = centerY - height / 2
  const rad = (placement.rotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  sprite.position.set(
    placement.x + localX * cos - localY * sin,
    placement.y + localX * sin + localY * cos
  )
  sprite.angle = placement.rotation
  sprite.visible = placement.visible
  sprite.alpha = (tile.alpha ?? 1) * (placement.opacity ?? 1)
  applyFlip(sprite, tile, width, height)
  return sprite
}

/** An animated, GIF or static sprite for a tile, before placement and sizing. */
function createTileVisual(tile: ResolvedTile, tsRenderer: TileSetRenderer): Sprite | null {
  const animFrames = tsRenderer.getAnimationFrames(tile.localId)

  if (animFrames && animFrames.length > 1) {
    const textures: { texture: Texture; time: number }[] = []
    for (const frame of animFrames) {
      const tex = tsRenderer.getTexture(frame.tileid)
      if (!tex) return null
      textures.push({ texture: tex, time: frame.duration })
    }
    const sprite = new AnimatedSprite(textures)
    sprite.play()
    return sprite
  }

  const texture = tsRenderer.getTexture(tile.localId)
  if (!texture) return null

  const gifSource = tsRenderer.getGifSource(tile.localId)
  return gifSource ? createGifSprite(gifSource) : new Sprite(texture)
}

const ALIGNMENT_FACTORS: Record<Exclude<TiledObjectAlignment, 'unspecified'>, [number, number]> = {
  topleft: [0, 0],
  top: [0.5, 0],
  topright: [1, 0],
  left: [0, 0.5],
  center: [0.5, 0.5],
  right: [1, 0.5],
  bottomleft: [0, 1],
  bottom: [0.5, 1],
  bottomright: [1, 1]
}

/**
 * Where a tile object's origin sits in its box. Tiled defaults tile objects to
 * bottom-left, and to bottom-center on isometric maps.
 */
function alignmentFactors(
  alignment: TiledObjectAlignment,
  orientation: MapContext['orientation'] | undefined
): [number, number] {
  if (alignment !== 'unspecified') return ALIGNMENT_FACTORS[alignment]
  return orientation === 'isometric' ? ALIGNMENT_FACTORS.bottom : ALIGNMENT_FACTORS.bottomleft
}

/** Scale signs and anchor of one flip combination: [signX, signY, anchorX, anchorY]. */
type FlipTransform = readonly [number, number, number, number]

/**
 * Indexed by H + 2V + 4D. Tiled encodes rotations via the diagonal
 * (anti-diagonal) flip bit combined with H/V bits. Every diagonal case also
 * rotates by PI/2 (CW); the anchor and scale signs produce the four transforms:
 *   D      → transpose     anchor(0,0) scale( +,−)
 *   D+H    → 90° CW        anchor(0,1) scale( +,+)
 *   D+V    → 90° CCW       anchor(1,0) scale(−,−)
 *   D+H+V  → 270° CW       anchor(1,1) scale(−,+)
 */
const FLIP_TRANSFORMS: readonly FlipTransform[] = [
  [1, 1, 0, 0],
  [-1, 1, 1, 0],
  [1, -1, 0, 1],
  [-1, -1, 1, 1],
  [1, -1, 0, 0],
  [1, 1, 0, 1],
  [-1, -1, 1, 0],
  [-1, 1, 1, 1]
]

function flipIndex(tile: ResolvedTile): number {
  return (tile.horizontalFlip ? 1 : 0) + (tile.verticalFlip ? 2 : 0) + (tile.diagonalFlip ? 4 : 0)
}

/**
 * Sizes `sprite` to cover a `width` x `height` screen box whose top-left is the
 * sprite's position, drawing the texture with the tile's flips. A diagonal flip
 * swaps the texture's axes on screen, so the box width then comes from the
 * texture's height and vice versa.
 */
function applyFlip(sprite: Sprite, tile: ResolvedTile, width: number, height: number): void {
  const diagonal = tile.diagonalFlip
  const [signX, signY, anchorX, anchorY] = FLIP_TRANSFORMS[flipIndex(tile)]!
  const alongX = diagonal ? height : width
  const alongY = diagonal ? width : height

  // Rotation and anchor updates invalidate the sprite; skip the no-ops.
  if (diagonal) sprite.rotation += Math.PI / 2
  sprite.scale.set(
    (signX * alongX) / (sprite.texture.width || 1),
    (signY * alongY) / (sprite.texture.height || 1)
  )
  if (anchorX !== 0 || anchorY !== 0) sprite.anchor.set(anchorX, anchorY)
}
