/**
 * @vitest-environment jsdom
 */
import { type Container, type Graphics, type Sprite, Text, Texture } from 'pixi.js'
import { describe, expect, it, vi } from 'vitest'
import { ObjectLayerRenderer } from '../../src/renderer/ObjectLayerRenderer.js'
import { TileSetRenderer } from '../../src/renderer/TileSetRenderer.js'
import type { ResolvedObject, ResolvedTileset, TiledText } from '../../src/types/index.js'
import { makeResolvedObjectLayer, makeResolvedTileset } from '../helpers/resolved.js'

function makeTileset(overrides?: Partial<ResolvedTileset>): TileSetRenderer {
  const renderer = new TileSetRenderer(makeResolvedTileset(overrides), null)
  renderer.setTileTexture(0, Texture.EMPTY)
  return renderer
}

describe('ObjectLayerRenderer tile objects', () => {
  it('composes object rotation with diagonal tile flip rotation', () => {
    const layer = makeResolvedObjectLayer({
      objects: [
        {
          id: 1,
          name: '',
          type: '',
          x: 0,
          y: 32,
          width: 32,
          height: 32,
          rotation: 45,
          visible: true,
          tile: {
            gid: 1,
            localId: 0,
            tilesetIndex: 0,
            horizontalFlip: true,
            verticalFlip: false,
            diagonalFlip: true
          }
        }
      ]
    })

    const renderer = new ObjectLayerRenderer(layer, [makeTileset()])
    const sprite = renderer.children[0] as Sprite

    expect(sprite.angle).toBeCloseTo(135)
  })
})

function makeTextObject(text: TiledText, overrides?: Partial<ResolvedObject>): ResolvedObject {
  return {
    id: 1,
    name: 'label',
    type: '',
    x: 12,
    y: 34,
    width: 100,
    height: 20,
    rotation: 30,
    visible: false,
    text,
    ...overrides
  }
}

function renderObject(obj: ResolvedObject): Container {
  const renderer = new ObjectLayerRenderer(makeResolvedObjectLayer({ objects: [obj] }), [])
  return renderer.children[0] as Container
}

describe('ObjectLayerRenderer text objects', () => {
  /** jsdom cannot measure text, so decorated text gets a fixed size. */
  function stubTextSize(): void {
    vi.spyOn(Text.prototype, 'getSize').mockReturnValue({ width: 40, height: 20 })
  }

  it('renders plain text as a single placed Text node with Tiled defaults', () => {
    const node = renderObject(makeTextObject({ text: 'hello' }))

    expect(node).toBeInstanceOf(Text)
    const text = node as Text
    expect(text.text).toBe('hello')
    expect(text.label).toBe('label')
    expect(text.position).toMatchObject({ x: 12, y: 34 })
    expect(text.angle).toBeCloseTo(30)
    expect(text.visible).toBe(false)
    expect(text.style.fontFamily).toBe('sans-serif')
    expect(text.style.fontSize).toBe(16)
    expect(text.style.fontWeight).toBe('normal')
    expect(text.style.fontStyle).toBe('normal')
    expect(text.style.wordWrap).toBe(false)
    expect(text.style.align).toBe('left')
  })

  it('maps the Tiled text style onto the Pixi style', () => {
    const text = renderObject(
      makeTextObject({
        text: 'styled',
        fontfamily: 'serif',
        pixelsize: 24,
        bold: true,
        italic: true,
        wrap: true,
        halign: 'center'
      })
    ) as Text

    expect(text.style.fontFamily).toBe('serif')
    expect(text.style.fontSize).toBe(24)
    expect(text.style.fontWeight).toBe('bold')
    expect(text.style.fontStyle).toBe('italic')
    expect(text.style.wordWrap).toBe(true)
    expect(text.style.wordWrapWidth).toBe(100)
    expect(text.style.align).toBe('center')
  })

  it('wraps decorated text in a placed container with one line per decoration', () => {
    stubTextSize()
    const node = renderObject(makeTextObject({ text: 'deco', underline: true, strikeout: true }))

    expect(node).not.toBeInstanceOf(Text)
    expect(node.label).toBe('label')
    expect(node.position).toMatchObject({ x: 12, y: 34 })
    expect(node.angle).toBeCloseTo(30)
    expect(node.visible).toBe(false)
    expect(node.children).toHaveLength(3)
    expect(node.children[0]).toBeInstanceOf(Text)
    expect(node.children[0]?.position).toMatchObject({ x: 0, y: 0 })
    const underline = (node.children[1] as Graphics).getLocalBounds()
    const strikeout = (node.children[2] as Graphics).getLocalBounds()
    // pixelsize 16 gives a 1px line; underline sits on the bottom edge.
    expect(underline.minX).toBeCloseTo(-0.5)
    expect(underline.maxX).toBeCloseTo(40.5)
    expect((underline.minY + underline.maxY) / 2).toBeCloseTo(19)
    expect((strikeout.minY + strikeout.maxY) / 2).toBeCloseTo(10)
  })

  it('draws only the requested decoration, scaled with the font size', () => {
    stubTextSize()
    const node = renderObject(makeTextObject({ text: 'deco', strikeout: true, pixelsize: 32 }))

    expect(node.children).toHaveLength(2)
    const strikeout = (node.children[1] as Graphics).getLocalBounds()
    expect(strikeout.maxY - strikeout.minY).toBeCloseTo(2)
    expect((strikeout.minY + strikeout.maxY) / 2).toBeCloseTo(10)
  })
})
