/**
 * @vitest-environment jsdom
 */
import { CanvasSource, DOMAdapter, Rectangle, Texture } from 'pixi.js'
import { describe, expect, it, vi } from 'vitest'
import { acquireColorKeyedTexture, releaseColorKeyedTexture } from '../../src/renderer/colorKey.js'
import { ImageLayerRenderer } from '../../src/renderer/ImageLayerRenderer.js'
import { TiledMap } from '../../src/renderer/TiledMap.js'
import { TileSetRenderer } from '../../src/renderer/TileSetRenderer.js'
import {
  makeResolvedImageLayer,
  makeResolvedMap,
  makeResolvedTile,
  makeResolvedTileLayer,
  makeResolvedTileset
} from '../helpers/resolved.js'

/** A 2x1 source whose canvas hands out the given RGBA pixels. */
function stubPixels(rgba: number[]): {
  texture: Texture
  written: () => number[]
  reads: () => number
} {
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
  return {
    texture,
    written: () => written,
    reads: () => context.getImageData.mock.calls.length
  }
}

describe('acquireColorKeyedTexture', () => {
  it('clears the alpha of exactly the keyed color and keeps the frame', () => {
    const { texture, written } = stubPixels([255, 0, 255, 255, 255, 0, 254, 255])

    const keyed = acquireColorKeyedTexture(texture, '#ff00ff')

    expect(keyed).toBeInstanceOf(Texture)
    expect(keyed!.source).not.toBe(texture.source)
    expect(keyed!.frame).toMatchObject({ x: 1, y: 0, width: 1, height: 1 })
    expect(written()).toEqual([255, 0, 255, 0, 255, 0, 254, 255])
  })

  it('shares one keyed source per source and color until its last user releases it', () => {
    const { texture, reads } = stubPixels([255, 0, 255, 255, 0, 0, 0, 255])

    const first = acquireColorKeyedTexture(texture, '#ff00ff')!
    const second = acquireColorKeyedTexture(texture, 'ff00ff')!
    const source = first.source

    expect(second.source).toBe(source)
    expect(reads()).toBe(1)

    releaseColorKeyedTexture(first)
    expect(first.destroyed).toBe(true)
    expect(source.destroyed).toBe(false)

    releaseColorKeyedTexture(second)
    expect(source.destroyed).toBe(true)

    const again = acquireColorKeyedTexture(texture, '#ff00ff')!
    expect(again.source).not.toBe(source)
    expect(reads()).toBe(2)
    releaseColorKeyedTexture(again)
  })

  it('keys again when the shared copy was destroyed elsewhere', () => {
    const { texture, reads } = stubPixels([255, 0, 255, 255, 0, 0, 0, 255])

    const stale = acquireColorKeyedTexture(texture, '#ff00ff')!
    stale.source.destroy()
    const fresh = acquireColorKeyedTexture(texture, '#ff00ff')!

    expect(fresh.source).not.toBe(stale.source)
    expect(fresh.source.destroyed).toBe(false)
    expect(reads()).toBe(2)

    // Releasing the replaced copy leaves the current one cached.
    releaseColorKeyedTexture(stale)
    const shared = acquireColorKeyedTexture(texture, '#ff00ff')!
    expect(shared.source).toBe(fresh.source)
    expect(reads()).toBe(2)
    releaseColorKeyedTexture(fresh)
    releaseColorKeyedTexture(shared)
  })

  it('follows the scale mode of the original source', () => {
    const { texture } = stubPixels([255, 0, 255, 255, 0, 0, 0, 255])
    texture.source.scaleMode = 'linear'

    const first = acquireColorKeyedTexture(texture, '#ff00ff')!
    expect(first.source.scaleMode).toBe('linear')

    texture.source.scaleMode = 'nearest'
    const second = acquireColorKeyedTexture(texture, '#ff00ff')!
    expect(second.source).toBe(first.source)
    expect(first.source.scaleMode).toBe('nearest')
    releaseColorKeyedTexture(first)
    releaseColorKeyedTexture(second)
  })

  it('returns null when the pixels cannot be read', () => {
    const canvas = document.createElement('canvas')
    vi.spyOn(canvas, 'getContext').mockReturnValue(null)
    vi.spyOn(DOMAdapter.get(), 'createCanvas').mockReturnValue(canvas)
    const texture = new Texture({ source: new CanvasSource({ resource: canvas }) })

    expect(acquireColorKeyedTexture(texture, '#ff00ff')).toBeNull()
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
    expect(keyed.source.destroyed).toBe(true)
    expect(texture.destroyed).toBe(false)
  })

  it('keeps the keyed atlas for tile layers a map destroy only detaches', () => {
    const { texture } = stubPixels([255, 0, 255, 255, 0, 0, 0, 255])
    const tileset = makeResolvedTileset({ transparentcolor: '#ff00ff', image: 'atlas.png' })
    const mapData = makeResolvedMap({
      tilesets: [tileset],
      layers: [makeResolvedTileLayer({ width: 1, height: 1, tiles: [makeResolvedTile()] })]
    })
    const build = () =>
      new TiledMap(mapData, { tilesetTextures: new Map([['atlas.png', texture]]) })

    const destroyed = build()
    const destroyedSource = destroyed.tileSetRenderers[0]!.baseTexture!.source
    destroyed.destroy({ children: true })
    expect(destroyedSource.destroyed).toBe(true)

    const detached = build()
    const keyedSource = detached.tileSetRenderers[0]!.baseTexture!.source
    const layer = detached.children[0]!
    detached.destroy()
    expect(layer.destroyed).toBe(false)
    expect(keyedSource.destroyed).toBe(false)

    // Assets.unload destroys the map with its children, after the fact.
    detached.destroy({ children: true })
    expect(keyedSource.destroyed).toBe(false)
  })

  it('keys an image layer image', () => {
    const { texture } = stubPixels([0, 255, 0, 255, 0, 0, 0, 255])
    const layer = new ImageLayerRenderer(
      makeResolvedImageLayer({ transparentcolor: '#00ff00' }),
      texture
    )

    const sprite = layer.children[0] as unknown as { texture: Texture }
    expect(sprite.texture).not.toBe(texture)
    const keyedSource = sprite.texture.source
    layer.destroy({ children: true })
    expect(keyedSource.destroyed).toBe(true)
    expect(texture.destroyed).toBe(false)
  })

  it('leaves the keyed image to a sprite the layer destroy only detaches', () => {
    const { texture } = stubPixels([0, 255, 0, 255, 0, 0, 0, 255])
    const layer = new ImageLayerRenderer(
      makeResolvedImageLayer({ transparentcolor: '#00ff00' }),
      texture
    )
    const sprite = layer.children[0] as unknown as { texture: Texture }

    layer.destroy()

    expect(sprite.texture.destroyed).toBe(false)
    expect(sprite.texture.source.destroyed).toBe(false)
  })
})
