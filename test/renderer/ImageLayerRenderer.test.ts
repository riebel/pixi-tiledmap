/**
 * @vitest-environment jsdom
 */
import { Sprite, Texture, TilingSprite } from 'pixi.js'
import { GifSource, GifSprite } from 'pixi.js/gif'
import { describe, expect, it } from 'vitest'
import { ImageLayerRenderer } from '../../src/renderer/ImageLayerRenderer.js'
import type { MapContext } from '../../src/types/index.js'
import { makeResolvedImageLayer } from '../helpers/resolved.js'

const texture = new Texture({ source: Texture.WHITE.source })

function mapContext(mapPixelWidth: number, mapPixelHeight: number): MapContext {
  return {
    orientation: 'orthogonal',
    renderorder: 'right-down',
    tilewidth: 16,
    tileheight: 16,
    mapPixelWidth,
    mapPixelHeight,
    tileSpritePadding: 0
  }
}

describe('ImageLayerRenderer', () => {
  it('renders nothing without a texture', () => {
    const renderer = new ImageLayerRenderer(makeResolvedImageLayer(), null)

    expect(renderer.children).toHaveLength(0)
  })

  it('renders a non-repeating image as a plain sprite', () => {
    const renderer = new ImageLayerRenderer(makeResolvedImageLayer(), texture, mapContext(64, 64))

    expect(renderer.children).toHaveLength(1)
    expect(renderer.children[0]).toBeInstanceOf(Sprite)
    expect(renderer.children[0]).not.toBeInstanceOf(TilingSprite)
  })

  it('animates a non-repeating GIF image', () => {
    const gifSource = new GifSource([{ texture, start: 0, end: 100 }])
    const renderer = new ImageLayerRenderer(makeResolvedImageLayer(), texture, undefined, gifSource)

    expect(renderer.children[0]).toBeInstanceOf(GifSprite)
  })

  it('tiles a repeating image across the map on the repeating axes only', () => {
    const renderer = new ImageLayerRenderer(
      makeResolvedImageLayer({ repeatx: true }),
      texture,
      mapContext(200, 300)
    )
    const tiling = renderer.children[0] as TilingSprite

    expect(tiling).toBeInstanceOf(TilingSprite)
    expect(tiling.width).toBe(200)
    expect(tiling.height).toBe(texture.height)
  })

  it('tiles a repeating GIF with its first frame', () => {
    const gifSource = new GifSource([{ texture, start: 0, end: 100 }])
    const renderer = new ImageLayerRenderer(
      makeResolvedImageLayer({ repeatx: true, repeaty: true }),
      texture,
      mapContext(200, 300),
      gifSource
    )
    const tiling = renderer.children[0] as TilingSprite

    expect(tiling).toBeInstanceOf(TilingSprite)
    expect(tiling.width).toBe(200)
    expect(tiling.height).toBe(300)
  })

  it('falls back to the texture size when the map size is unknown or empty', () => {
    const withoutContext = new ImageLayerRenderer(
      makeResolvedImageLayer({ repeatx: true, repeaty: true }),
      texture
    ).children[0] as TilingSprite
    const emptyMap = new ImageLayerRenderer(
      makeResolvedImageLayer({ repeatx: true, repeaty: true }),
      texture,
      mapContext(0, 0)
    ).children[0] as TilingSprite

    for (const tiling of [withoutContext, emptyMap]) {
      expect(tiling.width).toBe(texture.width)
      expect(tiling.height).toBe(texture.height)
    }
  })
})
