import { CanvasSource, DOMAdapter, Texture } from 'pixi.js'

/**
 * Returns a copy of `texture` whose pixels of color `hex` (`#RRGGBB`) are fully
 * transparent, the way Tiled applies a tileset's or image layer's
 * `transparentcolor`. The whole source image is keyed, so frames cut from the
 * result line up with frames of the original.
 *
 * Returns `null` when the pixels cannot be read, for example without a 2D
 * canvas or for a source that is not an image; the caller then draws the
 * texture unkeyed. The caller owns the returned texture and its source.
 */
export function createColorKeyedTexture(texture: Texture, hex: string): Texture | null {
  const key = parseInt(hex.replace('#', '').slice(-6), 16)
  if (Number.isNaN(key)) return null

  const source = texture.source
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
    const data = pixels.data
    const r = (key >> 16) & 0xff
    const g = (key >> 8) & 0xff
    const b = key & 0xff
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] === r && data[i + 1] === g && data[i + 2] === b) data[i + 3] = 0
    }
    context.putImageData(pixels, 0, 0)

    const keyed = new CanvasSource({
      resource: canvas,
      resolution: source.resolution,
      scaleMode: source.scaleMode,
      alphaMode: 'premultiply-alpha-on-upload'
    })
    return new Texture({ source: keyed, frame: texture.frame.clone() })
  } catch {
    return null
  }
}
