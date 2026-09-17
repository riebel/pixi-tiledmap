import { CanvasSource, DOMAdapter, Texture, type TextureSource } from 'pixi.js'

interface KeyedSource {
  source: CanvasSource
  users: number
}

/**
 * Keyed copies by original source and key color. Reading the pixels back is
 * expensive, so every renderer keying the same image with the same color
 * shares one copy, and the copy lives as long as one of them holds it.
 */
const keyedSources = new WeakMap<TextureSource, Map<number, KeyedSource>>()
/** The shared copy behind each texture `acquireColorKeyedTexture` handed out. */
const heldTextures = new WeakMap<Texture, { original: TextureSource; key: number }>()

/**
 * Returns a copy of `texture` whose pixels of color `hex` (`#RRGGBB`) are fully
 * transparent, the way Tiled applies a tileset's or image layer's
 * `transparentcolor`. The whole source image is keyed, so frames cut from the
 * result line up with frames of the original.
 *
 * Returns `null` when the pixels cannot be read, for example without a 2D
 * canvas or for a source that is not an image; the caller then draws the
 * texture unkeyed. The keyed source is shared with other callers keying the
 * same source and color; hand the texture to `releaseColorKeyedTexture` when
 * done instead of destroying it.
 */
export function acquireColorKeyedTexture(texture: Texture, hex: string): Texture | null {
  const key = parseInt(hex.replace('#', '').slice(-6), 16)
  if (Number.isNaN(key)) return null

  const original = texture.source
  let byColor = keyedSources.get(original)
  let entry = byColor?.get(key)
  if (!entry) {
    const source = createColorKeyedSource(original, key)
    if (!source) return null
    entry = { source, users: 0 }
    if (!byColor) {
      byColor = new Map()
      keyedSources.set(original, byColor)
    }
    byColor.set(key, entry)
  }

  entry.users++
  const keyed = new Texture({ source: entry.source, frame: texture.frame.clone() })
  heldTextures.set(keyed, { original, key })
  return keyed
}

/**
 * Destroys a texture from `acquireColorKeyedTexture`, and its keyed source once
 * no other texture uses it.
 */
export function releaseColorKeyedTexture(texture: Texture): void {
  const held = heldTextures.get(texture)
  heldTextures.delete(texture)
  texture.destroy()
  if (!held) return

  const byColor = keyedSources.get(held.original)
  const entry = byColor?.get(held.key)
  if (!byColor || !entry || --entry.users > 0) return
  byColor.delete(held.key)
  if (byColor.size === 0) keyedSources.delete(held.original)
  entry.source.destroy()
}

function clearKeyedPixels(data: Uint8ClampedArray, key: number): void {
  const r = (key >> 16) & 0xff
  const g = (key >> 8) & 0xff
  const b = key & 0xff
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] === r && data[i + 1] === g && data[i + 2] === b) data[i + 3] = 0
  }
}

function createColorKeyedSource(source: TextureSource, key: number): CanvasSource | null {
  const image = source.resource as CanvasImageSource | undefined
  const width = source.pixelWidth
  const height = source.pixelHeight
  if (!image || width <= 0 || height <= 0) return null

  try {
    const canvas = DOMAdapter.get().createCanvas(width, height)
    const context = canvas.getContext('2d') as CanvasRenderingContext2D | null
    if (!context) return null
    context.drawImage(image, 0, 0)
    const pixels = context.getImageData(0, 0, width, height)
    clearKeyedPixels(pixels.data, key)
    context.putImageData(pixels, 0, 0)

    return new CanvasSource({
      resource: canvas,
      resolution: source.resolution,
      scaleMode: source.scaleMode,
      alphaMode: 'premultiply-alpha-on-upload'
    })
  } catch {
    return null
  }
}
