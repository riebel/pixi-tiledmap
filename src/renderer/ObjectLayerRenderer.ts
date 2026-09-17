import { Container, Graphics, Matrix, type Sprite, Text } from 'pixi.js'
import type {
  MapContext,
  ResolvedObject,
  ResolvedObjectLayer,
  TiledObjectStyle,
  TiledPoint,
  TiledText
} from '../types'
import { type AffineTransform, getObjectProjection } from './mapGeometry.js'
import { parseTintColor, tiledColorToCss } from './parseColor.js'
import { applyLayerState } from './renderableLayer.js'
import type { TileSetRenderer } from './TileSetRenderer.js'
import { createObjectTileSprite } from './tileSpriteFactory.js'

/** The Tiled editor's default object color. */
const DEFAULT_OBJECT_COLOR = '#a0a0a4'
/** The Tiled editor fills shapes with the object color at alpha 50/255. */
const DEFAULT_FILL_ALPHA = 50 / 255
const POINT_RADIUS = 3

interface ShapeStyle {
  color: number
  fillAlpha: number
  screenSpace: boolean
}

/** Adds a shape's path to `g`, shifted by (`dx`, `dy`). */
type ShapePath = (g: Graphics, dx: number, dy: number) => void

/** The linear part of an object's transform: object space to layer space. */
interface Linear {
  a: number
  b: number
  c: number
  d: number
}

/**
 * A shape drawn the way the Tiled editor does: a translucent fill, an outline
 * in the object color, and a dark shadow line offset by one pixel. In screen
 * space the outlines are one device pixel wide and the shadow offset is one
 * screen pixel, so the shape is redrawn when the screen scale changes.
 */
class ShapeDrawing {
  readonly graphics = new Graphics()

  constructor(
    private readonly _path: ShapePath,
    private readonly _style: ShapeStyle,
    private readonly _fillAlpha: number,
    private readonly _linear: Linear
  ) {
    this.draw(1)
  }

  draw(screenScale: number): void {
    const { color, screenSpace } = this._style
    const g = this.graphics.clear()
    let dx = 1
    let dy = 1
    if (screenSpace) {
      // One screen pixel down-right, taken back into object space.
      const { a, b, c, d } = this._linear
      const det = a * d - b * c
      const s = 1 / screenScale
      if (det !== 0) {
        dx = (d * s - c * s) / det
        dy = (a * s - b * s) / det
      }
    }
    this._path(g, dx, dy)
    g.stroke({ color: 0x000000, alpha: 0.5, width: 1, pixelLine: screenSpace })
    this._path(g, 0, 0)
    if (this._fillAlpha > 0) g.fill({ color, alpha: this._fillAlpha })
    g.stroke({ color, width: 1, pixelLine: screenSpace })
  }
}

function resolveShapeStyle(layer: ResolvedObjectLayer, style?: TiledObjectStyle): ShapeStyle {
  const { defaultColor = DEFAULT_OBJECT_COLOR, fillAlpha = DEFAULT_FILL_ALPHA } = style ?? {}
  return {
    color: parseTintColor(layer.color ?? defaultColor),
    fillAlpha,
    screenSpace: style?.screenSpace !== false
  }
}

const scratchMatrix = new Matrix()

/** How many screen pixels one local unit of `container` covers. */
function screenScaleOf(container: Container): number {
  const m = container.getGlobalTransform(scratchMatrix)
  return Math.sqrt(Math.abs(m.a * m.d - m.b * m.c))
}

export class ObjectLayerRenderer extends Container {
  readonly layerData: ResolvedObjectLayer
  /**
   * Name labels of shape objects, drawn above all objects like in the Tiled
   * editor. `null` when the layer has no labelled objects or labels are off.
   */
  readonly labels: Container | null = null
  private readonly _shapeStyle: ShapeStyle
  private readonly _clipText: boolean
  private readonly _projection: AffineTransform | null
  private readonly _orientation: MapContext['orientation'] | undefined
  private readonly _shapes: ShapeDrawing[] = []
  private _labelsLaidOut = false
  private _screenScale = 1

  constructor(
    layerData: ResolvedObjectLayer,
    tilesets: TileSetRenderer[],
    style?: TiledObjectStyle,
    ctx?: MapContext
  ) {
    super()

    this.layerData = layerData
    applyLayerState(this, layerData)

    this._shapeStyle = resolveShapeStyle(layerData, style)
    this._clipText = style?.clipText !== false
    this._projection = ctx ? getObjectProjection(ctx) : null
    this._orientation = ctx?.orientation

    this._buildObjects(tilesets)
    if (style?.showLabels !== false) this.labels = this._buildLabels()
    if (this._needsRenderHook()) this.onRender = this._syncWithScreen
  }

  private _needsRenderHook(): boolean {
    if (this.labels) return true
    return this._shapeStyle.screenSpace && this._shapes.length > 0
  }

  /**
   * Runs before each render. Sizing a label box measures its text, which needs
   * a canvas, so it waits for the first render; that keeps building a map
   * possible where text cannot be measured, such as headless tests. In screen
   * space it also keeps outlines and labels at a constant on-screen size.
   */
  private readonly _syncWithScreen = (): void => {
    this._layoutLabelsOnce()
    if (this._shapeStyle.screenSpace) {
      this._applyScreenScale(screenScaleOf(this))
      return
    }
    // Pixi iterates the onRender list while calling this, so unhook later.
    queueMicrotask(() => {
      if (this.onRender === this._syncWithScreen) this.onRender = null
    })
  }

  private _layoutLabelsOnce(): void {
    if (!this.labels || this._labelsLaidOut) return
    layoutNameLabels(this.labels, this._shapeStyle.color)
    this._labelsLaidOut = true
  }

  private _applyScreenScale(scale: number): void {
    if (scale === 0 || scale === this._screenScale) return
    this._screenScale = scale
    for (const shape of this._shapes) shape.draw(scale)
    for (const label of this.labels?.children ?? []) label.scale.set(1 / scale)
  }

  /** Where Tiled draws an object's origin, in layer space. */
  private _objectOrigin(obj: ResolvedObject): { x: number; y: number } {
    const p = this._projection
    if (!p) return { x: obj.x, y: obj.y }
    return { x: p.a * obj.x + p.c * obj.y + p.tx, y: p.b * obj.x + p.d * obj.y + p.ty }
  }

  /** Object space to layer space for a shape: rotation, then projection. */
  private _shapeTransform(obj: ResolvedObject): Matrix {
    const origin = this._objectOrigin(obj)
    const rad = (obj.rotation * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    const m = new Matrix(cos, sin, -sin, cos, origin.x, origin.y)
    const p = this._projection
    if (p) m.append(new Matrix(p.a, p.b, p.c, p.d, 0, 0))
    return m
  }

  private _buildLabels(): Container | null {
    let labels: Container | null = null
    for (const obj of this.layerData.objects) {
      if (!obj.name || obj.tile || obj.text) continue
      const bounds = this._shapeBounds(obj)
      if (!bounds) continue
      labels ??= new Container({ label: 'objectLabels' })
      const label = createNameLabel(obj.name)
      label.position.set((bounds.minX + bounds.maxX) / 2, bounds.minY)
      label.visible = obj.visible
      labels.addChild(label)
    }
    if (labels) this.addChild(labels)
    return labels
  }

  /** Axis-aligned layer-space bounds of a shape object; `null` for undrawn shapes. */
  private _shapeBounds(obj: ResolvedObject): Bounds | null {
    if (obj.point) {
      const { x, y } = this._objectOrigin(obj)
      return {
        minX: x - POINT_RADIUS,
        minY: y - POINT_RADIUS,
        maxX: x + POINT_RADIUS,
        maxY: y + POINT_RADIUS
      }
    }
    const outline = shapeOutline(obj)
    if (outline.length === 0) return null
    const m = this._shapeTransform(obj)
    const bounds: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
    for (const p of outline) {
      const x = m.a * p.x + m.c * p.y + m.tx
      const y = m.b * p.x + m.d * p.y + m.ty
      bounds.minX = Math.min(bounds.minX, x)
      bounds.maxX = Math.max(bounds.maxX, x)
      bounds.minY = Math.min(bounds.minY, y)
      bounds.maxY = Math.max(bounds.maxY, y)
    }
    return bounds
  }

  private _buildObjects(tilesets: TileSetRenderer[]): void {
    for (const obj of this._objectsInDrawOrder()) {
      const child = this._createObject(obj, tilesets)
      if (child) {
        child.label = obj.name || `object_${obj.id}`
        if (obj.opacity !== undefined) child.alpha *= obj.opacity
        this.addChild(child)
      }
    }
  }

  /**
   * Tiled draws a `topdown` layer sorted by the on-screen y of each object's
   * origin, keeping the stored order for ties; an `index` layer keeps the
   * stored order.
   */
  private _objectsInDrawOrder(): ResolvedObject[] {
    const objects = this.layerData.objects
    if (this.layerData.draworder !== 'topdown') return objects
    return objects
      .map((obj) => ({ obj, y: this._objectOrigin(obj).y }))
      .sort((a, b) => a.y - b.y)
      .map((entry) => entry.obj)
  }

  private _createObject(obj: ResolvedObject, tilesets: TileSetRenderer[]): Container | null {
    if (obj.tile) return this._createTileObject(obj, tilesets)
    if (obj.text) return this._createTextObject(obj, obj.text)
    return this._createShape(obj)
  }

  /** Shape flags checked in the order Tiled's shape precedence implies. */
  private _createShape(obj: ResolvedObject): Container | null {
    if (obj.ellipse) return this._createEllipse(obj)
    if (obj.capsule) return this._createCapsule(obj)
    if (obj.point) return this._createPoint(obj)
    if (obj.polygon) return this._createPolygon(obj, obj.polygon, true)
    if (obj.polyline) return this._createPolygon(obj, obj.polyline, false)
    return obj.width > 0 && obj.height > 0 ? this._createRectangle(obj) : null
  }

  private _createTileObject(obj: ResolvedObject, tilesets: TileSetRenderer[]): Sprite | null {
    const tile = obj.tile!
    const ts = tilesets[tile.tilesetIndex]
    if (!ts) return null

    const origin = this._objectOrigin(obj)
    return createObjectTileSprite(tile, ts, {
      x: origin.x,
      y: origin.y,
      width: obj.width,
      height: obj.height,
      rotation: obj.rotation,
      visible: obj.visible,
      orientation: this._orientation
    })
  }

  /**
   * Tiled draws text into the object's box: the block is aligned by
   * `halign`/`valign` and clipped to the box. The box is in screen space even
   * on projected maps; only its origin is projected.
   */
  private _createTextObject(obj: ResolvedObject, td: TiledText): Container {
    const text = createText(td, obj.width)
    const [alignX, alignY] = textAlignment(td)
    text.anchor.set(alignX, alignY)
    text.position.set(alignX * obj.width, alignY * obj.height)

    const clip = this._clipText && obj.width > 0 && obj.height > 0
    const decorated = td.underline || td.strikeout
    const origin = this._objectOrigin(obj)
    if (!clip && !decorated) return placeRotated(text, obj, origin)

    const node = new Container()
    node.addChild(text)
    if (decorated) decorateText(node, text, td, alignX, alignY)
    if (clip) clipToBox(node, obj.width, obj.height)
    node.position.set(origin.x, origin.y)
    node.angle = obj.rotation
    node.visible = obj.visible
    return node
  }

  private _createRectangle(obj: ResolvedObject): Container {
    return this._drawShape(obj, (g, dx, dy) => g.rect(dx, dy, obj.width, obj.height))
  }

  private _createEllipse(obj: ResolvedObject): Container {
    const rx = obj.width / 2
    const ry = obj.height / 2
    return this._drawShape(obj, (g, dx, dy) => g.ellipse(rx + dx, ry + dy, rx, ry))
  }

  /** A rectangle with fully rounded short ends, as Tiled 1.12 draws a capsule. */
  private _createCapsule(obj: ResolvedObject): Container {
    const radius = Math.min(obj.width, obj.height) / 2
    return this._drawShape(obj, (g, dx, dy) => g.roundRect(dx, dy, obj.width, obj.height, radius))
  }

  private _createPoint(obj: ResolvedObject): Container {
    // A point marker has no orientation and is not projected: it ignores the
    // object rotation and keeps its round shape.
    const shape = new ShapeDrawing(
      (g, dx, dy) => g.circle(dx, dy, POINT_RADIUS),
      this._shapeStyle,
      1,
      IDENTITY
    )
    this._shapes.push(shape)
    const origin = this._objectOrigin(obj)
    shape.graphics.position.set(origin.x, origin.y)
    shape.graphics.visible = obj.visible
    return shape.graphics
  }

  private _createPolygon(obj: ResolvedObject, points: TiledPoint[], closed: boolean): Container {
    if (points.length === 0) return this._place(new Graphics(), obj)

    const path: ShapePath = (g, dx, dy) => {
      const first = points[0]!
      g.moveTo(first.x + dx, first.y + dy)
      for (let i = 1; i < points.length; i++) {
        const pt = points[i]!
        g.lineTo(pt.x + dx, pt.y + dy)
      }
      if (closed) g.closePath()
    }
    return this._drawShape(obj, path, closed)
  }

  private _drawShape(obj: ResolvedObject, path: ShapePath, filled = true): Graphics {
    const fillAlpha = filled ? this._shapeStyle.fillAlpha : 0
    const transform = this._shapeTransform(obj)
    const shape = new ShapeDrawing(path, this._shapeStyle, fillAlpha, transform)
    this._shapes.push(shape)
    return this._place(shape.graphics, obj, transform)
  }

  /**
   * Places a shape node. Without a projection the node keeps a plain position
   * and angle; a projected shape takes the full object-to-layer matrix.
   */
  private _place<T extends Container>(node: T, obj: ResolvedObject, transform?: Matrix): T {
    if (this._projection) {
      node.setFromMatrix(transform ?? this._shapeTransform(obj))
    } else {
      node.position.set(obj.x, obj.y)
      node.angle = obj.rotation
    }
    node.visible = obj.visible
    return node
  }
}

const IDENTITY: Linear = { a: 1, b: 0, c: 0, d: 1 }

/** Where an alignment puts the text block: 0 at the start, 1 at the end. */
const TEXT_ALIGN: Record<NonNullable<TiledText['halign'] | TiledText['valign']>, number> = {
  left: 0,
  justify: 0,
  top: 0,
  center: 0.5,
  right: 1,
  bottom: 1
}

function textAlignment(td: TiledText): [number, number] {
  return [TEXT_ALIGN[td.halign ?? 'left'], TEXT_ALIGN[td.valign ?? 'top']]
}

/**
 * Moves `node`, positioned in the object's own frame, into layer space by
 * rotating it around the object origin.
 */
function placeRotated<T extends Container>(
  node: T,
  obj: ResolvedObject,
  origin: { x: number; y: number }
): T {
  const rad = (obj.rotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  node.position.set(origin.x + node.x * cos - node.y * sin, origin.y + node.x * sin + node.y * cos)
  node.angle = obj.rotation
  node.visible = obj.visible
  return node
}

function clipToBox(node: Container, width: number, height: number): void {
  const mask = new Graphics().rect(0, 0, width, height).fill(0xffffff)
  node.addChild(mask)
  node.mask = mask
}

interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** Points spanning a shape in object space; empty for shapes that are not drawn. */
function shapeOutline(obj: ResolvedObject): TiledPoint[] {
  const points = obj.polygon ?? obj.polyline
  if (points) return points
  if (obj.width <= 0 || obj.height <= 0) return []
  return [
    { x: 0, y: 0 },
    { x: obj.width, y: 0 },
    { x: 0, y: obj.height },
    { x: obj.width, y: obj.height }
  ]
}

const LABEL_FONT_SIZE = 12
const LABEL_PADDING_X = 4
const LABEL_PADDING_Y = 1
/** Gap between the label and the top of the object's bounds. */
const LABEL_DISTANCE = 4

/**
 * A name tag like the Tiled editor's: white text with a dark shadow on a
 * rounded box in the object color. The origin is the bottom center of the gap
 * below the box, so the caller places it on the top center of the object.
 * The box stays empty until `layoutNameLabels` sizes it.
 */
function createNameLabel(name: string): Container {
  const text = new Text({
    text: name,
    anchor: { x: 0.5, y: 1 },
    // Centered text of odd width would sit on half pixels and blur.
    roundPixels: true,
    style: {
      fontFamily: 'sans-serif',
      fontSize: LABEL_FONT_SIZE,
      fill: 0xffffff,
      dropShadow: { color: 0x000000, alpha: 1, angle: Math.PI / 4, blur: 0, distance: 1 }
    }
  })
  text.position.set(0, -LABEL_DISTANCE - LABEL_PADDING_Y)

  const label = new Container({ label: name })
  label.addChild(new Graphics(), text)
  return label
}

/** Draws the box of every label in `labels` around its measured text. */
function layoutNameLabels(labels: Container, color: number): void {
  for (const label of labels.children) {
    const box = label.children[0] as Graphics
    const { width, height } = (label.children[1] as Text).getSize()
    const boxWidth = width + LABEL_PADDING_X * 2
    const boxHeight = height + LABEL_PADDING_Y * 2
    const left = -boxWidth / 2
    const top = -LABEL_DISTANCE - boxHeight
    box
      .clear()
      .roundRect(left + 1, top + 1, boxWidth, boxHeight, 4)
      .fill(0x000000)
      .roundRect(left, top, boxWidth, boxHeight, 4)
      .fill(color)
  }
}

const DEFAULT_TEXT_COLOR = '#000000'
const DEFAULT_PIXEL_SIZE = 16

function createText(td: TiledText, wrapWidth: number): Text {
  const wrap = td.wrap ?? false
  const text = new Text({
    text: td.text,
    style: {
      fontFamily: td.fontfamily ?? 'sans-serif',
      fontSize: td.pixelsize ?? DEFAULT_PIXEL_SIZE,
      // Tiled writes #AARRGGBB; Pixi reads 8-digit hex as #RRGGBBAA.
      fill: tiledColorToCss(td.color ?? DEFAULT_TEXT_COLOR),
      fontWeight: td.bold ? 'bold' : 'normal',
      fontStyle: td.italic ? 'italic' : 'normal',
      wordWrap: wrap,
      wordWrapWidth: wrapWidth,
      // Tiled wraps at word boundaries, and inside a word too long for a line.
      breakWords: wrap,
      align: td.halign ?? 'left'
    }
  })
  return text
}

/**
 * Adds underline and strikeout lines under `text`, sized to the rendered text
 * and placed where its anchor puts it.
 */
function decorateText(
  container: Container,
  text: Text,
  td: TiledText,
  alignX: number,
  alignY: number
): void {
  const { width, height } = text.getSize()
  const left = text.x - alignX * width
  const top = text.y - alignY * height
  const stroke = {
    color: tiledColorToCss(td.color ?? DEFAULT_TEXT_COLOR),
    width: Math.max(1, (td.pixelsize ?? DEFAULT_PIXEL_SIZE) / DEFAULT_PIXEL_SIZE)
  }
  if (td.underline) {
    const y = top + height - stroke.width
    container.addChild(
      new Graphics()
        .moveTo(left, y)
        .lineTo(left + width, y)
        .stroke(stroke)
    )
  }
  if (td.strikeout) {
    const y = top + height / 2
    container.addChild(
      new Graphics()
        .moveTo(left, y)
        .lineTo(left + width, y)
        .stroke(stroke)
    )
  }
}
