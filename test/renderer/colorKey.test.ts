/**
 * @vitest-environment jsdom
 */
import { CanvasSource, DOMAdapter, Rectangle, Texture } from 'pixi.js'
import { describe, expect, it, vi } from 'vitest'
import { createColorKeyedTexture } from '../../src/renderer/colorKey.js'
import { ImageLayerRenderer } from '../../src/renderer/ImageLayerRenderer.js'
import { TileSetRenderer } from '../../src/renderer/TileSetRenderer.js'
import { makeResolvedImageLayer, makeResolvedTileset } from '../helpers/resolved.js'

/** A 2x1 source whose canvas hands out the given RGBA pixels. */
function stubPixels(rgba: number[]): { texture: Texture; written: () => number[] } {
  const pixels = { data: Uint8ClampedArray.from(rgba) } as ImageData
  let written: number[] = []
  const context = {
    drawImage: vi.fn(),
    getImageData: vi.fn(() => pixels),
    putImageData: vi.fn((data: ImageData) => {
      written = Array.from(data.data)
    })
  }
  const canvas = document.createElement('canvas')
  vi.spyOn(canvas, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
  vi.spyOn(DOMAdapter.get(), 'createCanvas').mockReturnValue(canvas)

  const image = document.createElement('canvas')
  image.width = 2
  image.height = 1
  const texture = new Texture({
    source: new CanvasSource({ resource: image }),
    frame: new Rectangle(1, 0, 1, 1)
  })
  return { texture, written: () => written }
}

describe('createColorKeyedTexture', () => {
  it('clears the alpha of exactly the keyed color and keeps the frame', () => {
    const { texture, written } = stubPixels([255, 0, 255, 255, 255, 0, 254, 255])

    const keyed = createColorKeyedTexture(texture, '#ff00ff')

    expect(keyed).toBeInstanceOf(Texture)
    expect(keyed!.source).not.toBe(texture.source)
    expect(keyed!.frame).toMatchObject({ x: 1, y: 0, width: 1, height: 1 })
    expect(written()).toEqual([255, 0, 255, 0, 255, 0, 254, 255])
  })

  it('returns null when the pixels cannot be read', () => {
    const canvas = document.createElement('canvas')
    vi.spyOn(canvas, 'getContext').mockReturnValue(null)
    vi.spyOn(DOMAdapter.get(), 'createCanvas').mockReturnValue(canvas)
    const texture = new Texture({ source: new CanvasSource({ resource: canvas }) })

    expect(createColorKeyedTexture(texture, '#ff00ff')).toBeNull()
  })
})

describe('transparentcolor in renderers', () => {
  it('keys a tileset atlas and destroys the copy with the renderer', () => {
    const { texture } = stubPixels([255, 0, 255, 255, 0, 0, 0, 255])
    const renderer = new TileSetRenderer(
      makeResolvedTileset({ transparentcolor: '#ff00ff' }),
      texture
    )

    expect(renderer.baseTexture).not.toBe(texture)
    const keyed = renderer.baseTexture!
    renderer.destroy()
    expect(keyed.destroyed).toBe(true)
    expect(texture.destroyed).toBe(false)
  })

  it('keys an image layer image', () => {
    const { texture } = stubPixels([0, 255, 0, 255, 0, 0, 0, 255])
    const layer = new ImageLayerRenderer(
      makeResolvedImageLayer({ transparentcolor: '#00ff00' }),
      texture
    )

    const sprite = layer.children[0] as unknown as { texture: Texture }
    expect(sprite.texture).not.toBe(texture)
    layer.destroy({ children: true })
    expect(texture.destroyed).toBe(false)
  })
})
