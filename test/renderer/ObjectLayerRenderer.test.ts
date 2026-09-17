/**
 * @vitest-environment jsdom
 */
import { AnimatedSprite, Container, Graphics, type Sprite, Text, Texture } from 'pixi.js'
import { describe, expect, it, vi } from 'vitest'
import { ObjectLayerRenderer } from '../../src/renderer/ObjectLayerRenderer.js'
import { TileSetRenderer } from '../../src/renderer/TileSetRenderer.js'
import type {
  MapContext,
  ResolvedObject,
  ResolvedTileset,
  TiledObjectStyle,
  TiledText
} from '../../src/types/index.js'
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

function renderObject(obj: ResolvedObject, style?: TiledObjectStyle): Container {
  const renderer = new ObjectLayerRenderer(makeResolvedObjectLayer({ objects: [obj] }), [], style)
  return renderer.children[0] as Container
}

function textOf(node: Container): Text {
  const text = node.children.find((child) => child instanceof Text)
  expect(text).toBeInstanceOf(Text)
  return text as Text
}

describe('ObjectLayerRenderer text objects', () => {
  /** jsdom cannot measure text, so decorated text gets a fixed size. */
  function stubTextSize(): void {
    vi.spyOn(Text.prototype, 'getSize').mockReturnValue({ width: 40, height: 20 })
  }

  it('clips text to its box in a placed container, as Tiled does', () => {
    const node = renderObject(makeTextObject({ text: 'hello' }))

    expect(node).not.toBeInstanceOf(Text)
    expect(node.label).toBe('label')
    expect(node.position).toMatchObject({ x: 12, y: 34 })
    expect(node.angle).toBeCloseTo(30)
    expect(node.visible).toBe(false)
    expect(node.mask).toBeInstanceOf(Graphics)
    expect((node.mask as Graphics).getLocalBounds()).toMatchObject({
      minX: 0,
      minY: 0,
      maxX: 100,
      maxY: 20
    })
    expect(textOf(node).position).toMatchObject({ x: 0, y: 0 })
  })

  it('renders plain unclipped text as a single node rotated around the object origin', () => {
    const node = renderObject(
      makeTextObject({ text: 'hello', halign: 'right' }, { rotation: 90 }),
      { clipText: false }
    )

    expect(node).toBeInstanceOf(Text)
    const text = node as Text
    // The right-aligned anchor sits at (100, 0) in the box; turned 90 degrees
    // around (12, 34) that is (12, 134).
    expect(text.anchor).toMatchObject({ x: 1, y: 0 })
    expect(text.x).toBeCloseTo(12)
    expect(text.y).toBeCloseTo(134)
    expect(text.angle).toBeCloseTo(90)
  })

  it('renders text with Tiled defaults', () => {
    const text = textOf(renderObject(makeTextObject({ text: 'hello' })))
    expect(text.text).toBe('hello')
    expect(text.style.fontFamily).toBe('sans-serif')
    expect(text.style.fontSize).toBe(16)
    expect(text.style.fontWeight).toBe('normal')
    expect(text.style.fontStyle).toBe('normal')
    expect(text.style.wordWrap).toBe(false)
    expect(text.style.align).toBe('left')
  })

  it('maps the Tiled text style onto the Pixi style', () => {
    const text = textOf(
      renderObject(
        makeTextObject({
          text: 'styled',
          fontfamily: 'serif',
          pixelsize: 24,
          bold: true,
          italic: true,
          wrap: true,
          halign: 'center',
          color: '#80ff0000'
        })
      )
    )

    expect(text.style.fontFamily).toBe('serif')
    expect(text.style.fontSize).toBe(24)
    expect(text.style.fontWeight).toBe('bold')
    expect(text.style.fontStyle).toBe('italic')
    expect(text.style.wordWrap).toBe(true)
    expect(text.style.wordWrapWidth).toBe(100)
    expect(text.style.align).toBe('center')
    expect(text.style.breakWords).toBe(true)
    // Tiled writes #AARRGGBB: this is half-transparent red.
    expect(text.style.fill).toBe('#ff000080')
  })

  it('aligns the text block inside the object box', () => {
    const text = textOf(
      renderObject(makeTextObject({ text: 'x', halign: 'center', valign: 'bottom' }))
    )
    expect(text.anchor).toMatchObject({ x: 0.5, y: 1 })
    expect(text.position).toMatchObject({ x: 50, y: 20 })
  })

  it('wraps decorated text in a placed container with one line per decoration', () => {
    stubTextSize()
    const node = renderObject(makeTextObject({ text: 'deco', underline: true, strikeout: true }))

    expect(node).not.toBeInstanceOf(Text)
    expect(node.label).toBe('label')
    expect(node.position).toMatchObject({ x: 12, y: 34 })
    expect(node.angle).toBeCloseTo(30)
    expect(node.visible).toBe(false)
    // Text, underline, strikeout, clip mask.
    expect(node.children).toHaveLength(4)
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
    const node = renderObject(makeTextObject({ text: 'deco', strikeout: true, pixelsize: 32 }), {
      clipText: false
    })

    expect(node.children).toHaveLength(2)
    const strikeout = (node.children[1] as Graphics).getLocalBounds()
    expect(strikeout.maxY - strikeout.minY).toBeCloseTo(2)
    expect((strikeout.minY + strikeout.maxY) / 2).toBeCloseTo(10)
  })
})

function makeShape(overrides: Partial<ResolvedObject>): ResolvedObject {
  return {
    id: 1,
    name: '',
    type: '',
    x: 10,
    y: 20,
    width: 40,
    height: 30,
    rotation: 0,
    visible: true,
    ...overrides
  }
}

describe('ObjectLayerRenderer shape style', () => {
  /** jsdom cannot measure text, so labels get a fixed text size. */
  function stubTextSize(): void {
    vi.spyOn(Text.prototype, 'getSize').mockReturnValue({ width: 40, height: 14 })
  }

  function fills(g: Graphics): { color: number; alpha: number }[] {
    return g.context.instructions
      .filter((i) => i.action === 'fill')
      .map((i) => ({ color: i.data.style.color, alpha: i.data.style.alpha }))
  }

  function strokes(g: Graphics): { color: number; pixelLine: boolean }[] {
    return g.context.instructions
      .filter((i) => i.action === 'stroke')
      .map((i) => ({ color: i.data.style.color, pixelLine: i.data.style.pixelLine }))
  }

  /** Bounds of the path the first (shadow) stroke draws. */
  function shadowBounds(g: Graphics) {
    const shadow = g.context.instructions.find((i) => i.action === 'stroke')!
    return shadow.data.path!.bounds
  }

  /** Runs the hook Pixi calls before rendering the layer. */
  function render(renderer: ObjectLayerRenderer): void {
    renderer.onRender!(null as never)
  }

  function strokeColors(g: Graphics): number[] {
    return g.context.instructions
      .filter((i) => i.action === 'stroke')
      .map((i) => i.data.style.color)
  }

  it('fills closed shapes translucently in Tiled’s default gray', () => {
    const renderer = new ObjectLayerRenderer(
      makeResolvedObjectLayer({ objects: [makeShape({})] }),
      []
    )
    const g = renderer.children[0] as Graphics

    expect(fills(g)).toEqual([{ color: 0xa0a0a4, alpha: 50 / 255 }])
    expect(strokeColors(g)).toEqual([0x000000, 0xa0a0a4])
  })

  it('uses the layer color over the configured default and honours fillAlpha', () => {
    const layer = makeResolvedObjectLayer({ color: '#80ff0000', objects: [makeShape({})] })
    const renderer = new ObjectLayerRenderer(layer, [], {
      defaultColor: '#00ff00',
      fillAlpha: 0.5
    })

    expect(fills(renderer.children[0] as Graphics)).toEqual([{ color: 0xff0000, alpha: 0.5 }])
  })

  it('falls back to the configured default color and draws outlines only at fillAlpha 0', () => {
    const renderer = new ObjectLayerRenderer(
      makeResolvedObjectLayer({ objects: [makeShape({})] }),
      [],
      { defaultColor: '#00ff00', fillAlpha: 0 }
    )
    const g = renderer.children[0] as Graphics

    expect(fills(g)).toEqual([])
    expect(strokeColors(g)).toEqual([0x000000, 0x00ff00])
  })

  it('never fills polylines', () => {
    const polyline = makeShape({
      polyline: [
        { x: 0, y: 0 },
        { x: 10, y: 10 }
      ]
    })
    const renderer = new ObjectLayerRenderer(makeResolvedObjectLayer({ objects: [polyline] }), [])

    expect(fills(renderer.children[0] as Graphics)).toEqual([])
  })

  it('centers name labels above the rotated bounds of named shapes, on top of all objects', () => {
    stubTextSize()
    const layer = makeResolvedObjectLayer({
      objects: [
        makeShape({ id: 1, name: 'zone' }),
        makeShape({ id: 2, name: 'turned', x: 100, y: 100, width: 40, height: 20, rotation: 90 }),
        makeShape({ id: 3, name: 'spawn', x: 5, y: 6, width: 0, height: 0, point: true }),
        makeShape({ id: 4 }),
        makeShape({ id: 5, name: 'hidden', visible: false })
      ]
    })
    const renderer = new ObjectLayerRenderer(layer, [])

    const labels = renderer.labels
    expect(labels).toBeInstanceOf(Container)
    expect(renderer.children.at(-1)).toBe(labels)
    expect(labels!.children.map((c) => c.label)).toEqual(['zone', 'turned', 'spawn', 'hidden'])
    const [zone, turned, spawn, hidden] = labels!.children
    expect(zone!.position).toMatchObject({ x: 30, y: 20 })
    // Rotated 90° about its origin, the 40x20 rect spans x 80..100, y 100..140.
    expect(turned!.position.x).toBeCloseTo(90)
    expect(turned!.position.y).toBeCloseTo(100)
    expect(spawn!.position).toMatchObject({ x: 5, y: 3 })
    expect(hidden!.visible).toBe(false)

    const text = zone!.children[1] as Text
    expect(text.text).toBe('zone')
    expect(text.anchor).toMatchObject({ x: 0.5, y: 1 })
    expect(text.position).toMatchObject({ x: 0, y: -5 })

    // Boxes are sized on the first render, once text can be measured.
    expect((zone!.children[0] as Graphics).context.instructions).toHaveLength(0)
    render(renderer)
    // 40px text + 4px padding per side, centered. The box is 16px tall, ends
    // 4px above the object, and has a 1px shadow below it.
    const box = (zone!.children[0] as Graphics).getLocalBounds()
    expect(box.minY).toBeCloseTo(-20)
    expect(box.maxY).toBeCloseTo(-3)
    expect(box.minX).toBeCloseTo(-24)
  })

  it('does not label tile or text objects', () => {
    const layer = makeResolvedObjectLayer({
      objects: [makeTextObject({ text: 'hi' }, { name: 'caption' })]
    })

    expect(new ObjectLayerRenderer(layer, []).labels).toBeNull()
  })

  it('draws one-device-pixel outlines by default and scaled ones without screenSpace', () => {
    const layer = makeResolvedObjectLayer({ objects: [makeShape({})] })
    const crisp = new ObjectLayerRenderer(layer, []).children[0] as Graphics
    const scaled = new ObjectLayerRenderer(layer, [], { screenSpace: false })
      .children[0] as Graphics

    expect(strokes(crisp)).toEqual([
      { color: 0x000000, pixelLine: true },
      { color: 0xa0a0a4, pixelLine: true }
    ])
    expect(strokes(scaled).map((s) => s.pixelLine)).toEqual([false, false])
  })

  it('keeps labels and the shadow offset at their on-screen size when the map is scaled', () => {
    stubTextSize()
    const layer = makeResolvedObjectLayer({
      objects: [
        makeShape({ name: 'zone', x: 0, y: 0 }),
        makeShape({ id: 2, x: 0, y: 0, rotation: 90 })
      ]
    })
    const renderer = new ObjectLayerRenderer(layer, [])
    const camera = new Container()
    camera.scale.set(4)
    camera.addChild(renderer)
    const [plain, turned] = renderer.children as Graphics[]

    render(renderer)

    expect(renderer.labels!.children[0]!.scale).toMatchObject({ x: 0.25, y: 0.25 })
    // One screen pixel is a quarter unit, down-right on screen.
    expect(shadowBounds(plain!)).toMatchObject({ minX: 0.25, minY: 0.25 })
    // Rotated 90°, screen down-right is local down-left.
    expect(shadowBounds(turned!).minX).toBeCloseTo(0.25)
    expect(shadowBounds(turned!).minY).toBeCloseTo(-0.25)

    camera.scale.set(0.5)
    render(renderer)

    expect(renderer.labels!.children[0]!.scale).toMatchObject({ x: 2, y: 2 })
    expect(shadowBounds(plain!)).toMatchObject({ minX: 2, minY: 2 })
  })

  it('leaves labels scaled with the map and unhooks after layout without screenSpace', async () => {
    stubTextSize()
    const layer = makeResolvedObjectLayer({ objects: [makeShape({ name: 'zone' })] })
    const renderer = new ObjectLayerRenderer(layer, [], { screenSpace: false })
    const camera = new Container()
    camera.scale.set(4)
    camera.addChild(renderer)

    render(renderer)
    await Promise.resolve()

    expect(renderer.onRender).toBeNull()
    expect(renderer.labels!.children[0]!.scale).toMatchObject({ x: 1, y: 1 })
    expect(shadowBounds(renderer.children[0] as Graphics)).toMatchObject({ minX: 1, minY: 1 })
  })

  it('needs no render hook for a layer without shapes or labels', () => {
    const layer = makeResolvedObjectLayer({ objects: [makeTextObject({ text: 'hi' })] })

    expect(new ObjectLayerRenderer(layer, []).onRender).toBeNull()
  })

  it('omits labels when showLabels is false', () => {
    const layer = makeResolvedObjectLayer({ objects: [makeShape({ name: 'zone' })] })
    const renderer = new ObjectLayerRenderer(layer, [], { showLabels: false })

    expect(renderer.labels).toBeNull()
    expect(renderer.children).toHaveLength(1)
  })
})

describe('ObjectLayerRenderer placement like Tiled', () => {
  const orthogonal: MapContext = {
    orientation: 'orthogonal',
    renderorder: 'right-down',
    tilewidth: 32,
    tileheight: 32
  }
  const isometric: MapContext = { ...orthogonal, orientation: 'isometric', tileheight: 16 }

  function tileObject(overrides: Partial<ResolvedObject>): ResolvedObject {
    return makeShape({
      x: 100,
      y: 200,
      width: 32,
      height: 64,
      tile: {
        gid: 1,
        localId: 0,
        tilesetIndex: 0,
        horizontalFlip: false,
        verticalFlip: false,
        diagonalFlip: false
      },
      ...overrides
    })
  }

  function renderOne(
    obj: ResolvedObject,
    options: { ctx?: MapContext; tileset?: Partial<ResolvedTileset> } = {}
  ): Container {
    const tileset = makeTileset({ tilewidth: 16, tileheight: 16, ...options.tileset })
    const layer = makeResolvedObjectLayer({ objects: [obj] })
    return new ObjectLayerRenderer(layer, [tileset], { showLabels: false }, options.ctx)
      .children[0] as Container
  }

  function boundsOf(node: Container) {
    const b = node.getBounds()
    return { x: b.x, y: b.y, width: b.width, height: b.height }
  }

  function expectBounds(node: Container, expected: ReturnType<typeof boundsOf>) {
    const actual = boundsOf(node)
    for (const key of ['x', 'y', 'width', 'height'] as const) {
      expect(actual[key]).toBeCloseTo(expected[key])
    }
  }

  it('rotates a tile object around its bottom-left origin', () => {
    expectBounds(renderOne(tileObject({ rotation: 90 })), { x: 100, y: 200, width: 64, height: 32 })
  })

  it('keeps a flipped tile object at its object size', () => {
    const tile = { ...tileObject({}).tile!, horizontalFlip: true }
    expectBounds(renderOne(tileObject({ tile })), { x: 100, y: 136, width: 32, height: 64 })
  })

  it('aligns tile objects by the tileset objectalignment', () => {
    expectBounds(renderOne(tileObject({}), { tileset: { objectalignment: 'center' } }), {
      x: 84,
      y: 168,
      width: 32,
      height: 64
    })
  })

  it('projects tile objects on isometric maps and centers them on their origin', () => {
    // Object (32, 0) projects to x = 32 * 32 / 32 + 16 = 48, y = 16.
    expectBounds(renderOne(tileObject({ x: 32, y: 0 }), { ctx: isometric }), {
      x: 32,
      y: -48,
      width: 32,
      height: 64
    })
  })

  it('turns a diagonally flipped tile object by 60 degrees on hexagonal maps', () => {
    const hexagonal: MapContext = { ...orthogonal, orientation: 'hexagonal', hexsidelength: 16 }
    const tile = { ...tileObject({}).tile!, diagonalFlip: true }
    const sprite = renderOne(tileObject({ tile }), { ctx: hexagonal }) as Sprite
    // The 32x64 box sits above its bottom-left origin (100, 200); it turns
    // around its center (116, 168).
    expect(sprite.anchor).toMatchObject({ x: 0.5, y: 0.5 })
    expect(sprite.angle).toBeCloseTo(60)
    expect(sprite.x).toBeCloseTo(116)
    expect(sprite.y).toBeCloseTo(168)
  })

  it('draws rectangles as diamonds on isometric maps', () => {
    const node = renderOne(makeShape({ x: 0, y: 0, width: 16, height: 16 }), { ctx: isometric })
    // Object-space corners project onto the isometric grid.
    for (const [local, projected] of [
      [
        { x: 0, y: 0 },
        { x: 16, y: 0 }
      ],
      [
        { x: 16, y: 0 },
        { x: 32, y: 8 }
      ],
      [
        { x: 0, y: 16 },
        { x: 0, y: 8 }
      ],
      [
        { x: 16, y: 16 },
        { x: 16, y: 16 }
      ]
    ] as const) {
      const point = node.toGlobal(local)
      expect(point.x).toBeCloseTo(projected.x)
      expect(point.y).toBeCloseTo(projected.y)
    }
  })

  it('animates animated tiles used as objects', () => {
    const tiles = new Map([
      [
        0,
        {
          id: 0,
          animation: [
            { tileid: 0, duration: 100 },
            { tileid: 1, duration: 100 }
          ]
        }
      ]
    ])
    const tileset = makeTileset({ tiles, tilecount: 2, columns: 2 })
    tileset.setTileTexture(1, Texture.EMPTY)
    const layer = makeResolvedObjectLayer({ objects: [tileObject({})] })
    const sprite = new ObjectLayerRenderer(layer, [tileset]).children[0]
    expect(sprite).toBeInstanceOf(AnimatedSprite)
    ;(sprite as AnimatedSprite).stop()
  })

  it('sorts a topdown layer by origin y and keeps the stored order for index', () => {
    const objects = [
      makeShape({ id: 1, name: 'low', y: 50 }),
      makeShape({ id: 2, name: 'high', y: 10 }),
      makeShape({ id: 3, name: 'tie', y: 50 })
    ]
    const labelsOf = (draworder: 'topdown' | 'index') =>
      new ObjectLayerRenderer(makeResolvedObjectLayer({ draworder, objects }), [], {
        showLabels: false
      }).children.map((child) => child.label)

    expect(labelsOf('topdown')).toEqual(['high', 'low', 'tie'])
    expect(labelsOf('index')).toEqual(['low', 'high', 'tie'])
  })

  it('draws capsules and applies object opacity', () => {
    const node = renderOne(makeShape({ capsule: true, opacity: 0.25 }))
    expect(node).toBeInstanceOf(Graphics)
    expect(node.alpha).toBe(0.25)
  })
})
