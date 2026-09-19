import { Rectangle, Texture, type UVs } from 'pixi.js'
import type { TileSetRenderer } from './TileSetRenderer.js'

/**
 * Pixi filters a Texture's complete source, not its logical atlas frame. Keep
 * seam-protected map tiles half a source texel inside that frame so tiny GPU
 * interpolation errors cannot select a neighbouring atlas texel.
 */
const insetUvs = new WeakMap<Texture, UVs>()
const spriteTextures = new WeakMap<TileSetRenderer, Map<Texture, Texture>>()

export function getTileSeamUvs(texture: Texture): UVs {
  const cached = insetUvs.get(texture)
  if (cached) return cached

  const source = texture.uvs
  const uInset = Math.min(0.5 / texture.source.resolution / texture.frame.width, 0.5)
  const vInset = Math.min(0.5 / texture.source.resolution / texture.frame.height, 0.5)
  const uvs: UVs = {
    x0: source.x0 + (source.x1 - source.x0) * uInset + (source.x3 - source.x0) * vInset,
    y0: source.y0 + (source.y1 - source.y0) * uInset + (source.y3 - source.y0) * vInset,
    x1: source.x1 + (source.x0 - source.x1) * uInset + (source.x2 - source.x1) * vInset,
    y1: source.y1 + (source.y0 - source.y1) * uInset + (source.y2 - source.y1) * vInset,
    x2: source.x2 + (source.x3 - source.x2) * uInset + (source.x1 - source.x2) * vInset,
    y2: source.y2 + (source.y3 - source.y2) * uInset + (source.y1 - source.y2) * vInset,
    x3: source.x3 + (source.x2 - source.x3) * uInset + (source.x0 - source.x3) * vInset,
    y3: source.y3 + (source.y2 - source.y3) * uInset + (source.y0 - source.y3) * vInset
  }
  insetUvs.set(texture, uvs)
  return uvs
}

export function getTileSeamTexture(owner: TileSetRenderer, texture: Texture): Texture {
  let textures = spriteTextures.get(owner)
  if (!textures) {
    textures = new Map()
    spriteTextures.set(owner, textures)
  }
  const cached = textures.get(texture)
  if (cached && !cached.destroyed) return cached

  const frame = texture.frame
  const halfTexel = 0.5 / texture.source.resolution
  const insetX = Math.min(halfTexel, frame.width / 2)
  const insetY = Math.min(halfTexel, frame.height / 2)
  const inset = new Texture({
    source: texture.source,
    frame: new Rectangle(
      frame.x + insetX,
      frame.y + insetY,
      frame.width - insetX * 2,
      frame.height - insetY * 2
    ),
    // Preserve the sprite's layout size while only changing where it samples.
    orig: texture.orig.clone(),
    trim: texture.trim?.clone(),
    defaultAnchor: texture.defaultAnchor,
    defaultBorders: texture.defaultBorders,
    rotate: texture.rotate
  })
  textures.set(texture, inset)
  return inset
}

/** Releases the UV-inset wrapper textures owned by one tileset renderer. */
export function destroyTileSeamTextures(owner: TileSetRenderer): void {
  const textures = spriteTextures.get(owner)
  if (!textures) return
  for (const texture of textures.values()) texture.destroy()
  spriteTextures.delete(owner)
}
