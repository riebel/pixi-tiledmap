import type { MapContext, ResolvedMap, TileCell, TilePosition } from '../types'

export interface MapPixelSize {
  width: number
  height: number
}

export interface TileIterationPlan {
  rowStart: number
  rowEnd: number
  rowStep: number
  colStart: number
  colEnd: number
  colStep: number
}

// Reusable output object - avoids allocating a { x, y } per tile.
// Safe because callers consume the values before the next call.
const _pos: TilePosition = { x: 0, y: 0 }

export function computeMapPixelSize(mapData: ResolvedMap): MapPixelSize {
  const bounds = computeMapBounds(mapData)
  return { width: bounds.width, height: bounds.height }
}

export interface MapBounds extends MapPixelSize {
  x: number
  y: number
}

/**
 * The rectangle a map's grid covers in map space, following Tiled's renderers.
 * It starts at the origin except where the grid extends past it: isometric
 * maps reach left of it, and oblique maps with a negative skew reach left of
 * or above it.
 */
export function computeMapBounds(mapData: ResolvedMap): MapBounds {
  const { orientation, width, height, tilewidth, tileheight } = mapData

  switch (orientation) {
    case 'isometric':
      return {
        x: getScreenOrigin({ orientation, tilewidth, mapHeight: height }).x,
        y: 0,
        width: (width + height) * (tilewidth / 2),
        height: (width + height) * (tileheight / 2)
      }
    case 'staggered':
    case 'hexagonal':
      return { x: 0, y: 0, ...staggeredMapSize(mapData) }
    case 'oblique':
      return obliqueMapBounds(mapData)
    default:
      return { x: 0, y: 0, width: width * tilewidth, height: height * tileheight }
  }
}

/** Tiled's `HexagonalRenderer::boundingRect`, which also serves staggered maps. */
function staggeredMapSize(mapData: ResolvedMap): MapPixelSize {
  const { width, height, tilewidth, tileheight } = mapData
  const side = mapData.orientation === 'hexagonal' ? (mapData.hexsidelength ?? 0) : 0

  if (mapData.staggeraxis === 'x') {
    const sideOffsetX = (tilewidth - side) / 2
    return {
      width: width * (sideOffsetX + side) + sideOffsetX,
      height: height * tileheight + (width > 1 ? tileheight / 2 : 0)
    }
  }

  const sideOffsetY = (tileheight - side) / 2
  return {
    width: width * tilewidth + (height > 1 ? tilewidth / 2 : 0),
    height: height * (sideOffsetY + side) + sideOffsetY
  }
}

function obliqueMapBounds(mapData: ResolvedMap): MapBounds {
  const w = mapData.width * mapData.tilewidth
  const h = mapData.height * mapData.tileheight
  const shearX = obliqueShearX(mapData)
  const shearY = obliqueShearY(mapData)
  const xs = [0, w, h * shearX, w + h * shearX]
  const ys = [0, w * shearY, h, w * shearY + h]
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
}

function obliqueShearX(ctx: Pick<MapContext, 'skewx' | 'tileheight'>): number {
  return ctx.tileheight > 0 ? (ctx.skewx ?? 0) / ctx.tileheight : 0
}

function obliqueShearY(ctx: Pick<MapContext, 'skewy' | 'tilewidth'>): number {
  return ctx.tilewidth > 0 ? (ctx.skewy ?? 0) / ctx.tilewidth : 0
}

/** A 2D affine transform in PixiJS `Matrix` order: x' = a*x + c*y + tx. */
export interface AffineTransform {
  a: number
  b: number
  c: number
  d: number
  tx: number
  ty: number
}

/**
 * Maps object coordinates, which Tiled stores unprojected, into map space:
 * Tiled's `pixelToScreenCoords`. Only isometric and oblique maps project;
 * every other orientation returns `null`.
 *
 * Tile and text objects only move their origin through this; shapes are drawn
 * through it, so rectangles become diamonds on isometric maps.
 */
export function getObjectProjection(
  ctx: Pick<MapContext, 'orientation' | 'tilewidth' | 'tileheight' | 'skewx' | 'skewy'>
): AffineTransform | null {
  if (ctx.orientation === 'isometric') {
    if (ctx.tileheight <= 0) return null
    const ratio = ctx.tilewidth / (2 * ctx.tileheight)
    // Tile (0, 0) is drawn at x = 0 here, which puts the map's top corner - the
    // object origin - at tilewidth / 2.
    return { a: ratio, b: 0.5, c: -ratio, d: 0.5, tx: ctx.tilewidth / 2, ty: 0 }
  }
  if (ctx.orientation === 'oblique') {
    return { a: 1, b: obliqueShearY(ctx), c: obliqueShearX(ctx), d: 1, tx: 0, ty: 0 }
  }
  return null
}

/**
 * Where Tiled's screen origin lies in map space. Tiled shifts an isometric map
 * right so its left corner sits at x = 0; this library keeps tile (0, 0) at
 * x = 0 instead, so what Tiled places in screen space, such as image layers,
 * moves left by the difference. Zero for every other orientation.
 */
export function getScreenOrigin(
  ctx: Pick<MapContext, 'orientation' | 'tilewidth'> & { mapHeight?: number }
): { x: number; y: number } {
  if (ctx.orientation !== 'isometric' || !ctx.mapHeight) return { x: 0, y: 0 }
  return { x: ctx.tilewidth / 2 - (ctx.mapHeight * ctx.tilewidth) / 2, y: 0 }
}

/**
 * Maps a tile cell to the map-space position of its image box, for every
 * orientation: the inverse of `pixelToTile`.
 *
 * Every call returns the same object, overwritten in place, so renderers can
 * place thousands of tiles without allocating. Read `x` and `y` before the next
 * call, or copy them: `const { x, y } = tileToPixel(col, row, ctx)`.
 */
export function tileToPixel(col: number, row: number, ctx: MapContext): TilePosition {
  switch (ctx.orientation) {
    case 'orthogonal':
      _pos.x = col * ctx.tilewidth
      _pos.y = row * ctx.tileheight
      return _pos
    case 'isometric': {
      const halfW = ctx.tilewidth / 2
      const halfH = ctx.tileheight / 2
      _pos.x = (col - row) * halfW
      _pos.y = (col + row) * halfH
      return _pos
    }
    case 'staggered':
      return staggeredToPixel(col, row, ctx)
    case 'hexagonal':
      return hexagonalToPixel(col, row, ctx)
    case 'oblique':
      return obliqueToPixel(col, row, ctx)
  }
}

/**
 * Maps a point in map space back to the tile cell covering it: the inverse of
 * `tileToPixel`.
 *
 * Coordinates are in the same space `tileToPixel` produces, which is the
 * `TiledMap` container's local space. Note that isometric maps extend to the
 * left of the origin, so valid points there have negative x.
 *
 * The returned cell is unbounded - it may lie outside the map. Use `tileAt` to
 * resolve a point against a map's actual grid.
 */
export function pixelToTile(x: number, y: number, ctx: MapContext): TileCell {
  const cell = computeCell(x, y, ctx)
  // Math.floor and Math.round both yield -0 just below the origin. It compares
  // equal to 0, but would surface as "-0" to anything using Object.is.
  return { column: normalizeZero(cell.column), row: normalizeZero(cell.row) }
}

function computeCell(x: number, y: number, ctx: MapContext): TileCell {
  switch (ctx.orientation) {
    case 'orthogonal':
      return {
        column: Math.floor(x / ctx.tilewidth),
        row: Math.floor(y / ctx.tileheight)
      }
    case 'isometric':
      return isometricPixelToTile(x, y, ctx)
    case 'staggered':
    case 'hexagonal':
      return staggeredPixelToTile(x, y, ctx)
    case 'oblique':
      return obliquePixelToTile(x, y, ctx)
  }
}

/** Undo the shear, then read the orthogonal cell. */
function obliquePixelToTile(x: number, y: number, ctx: MapContext): TileCell {
  const shearX = obliqueShearX(ctx)
  const shearY = obliqueShearY(ctx)
  const det = 1 - shearX * shearY
  const px = det !== 0 ? (x - shearX * y) / det : x
  const py = det !== 0 ? (y - shearY * x) / det : y
  return {
    column: Math.floor(px / ctx.tilewidth),
    row: Math.floor(py / ctx.tileheight)
  }
}

function normalizeZero(value: number): number {
  return value === 0 ? 0 : value
}

/**
 * Isometric tiles are diamonds inscribed in the tile box, so the diamond for
 * (col, row) is centred half a tile past its `tileToPixel` anchor.
 *
 * Normalising by the half-tile size (s = x/halfW, t = y/halfH) puts that centre
 * at s = col - row + 1, t = col + row + 1, and turns the diamond into a unit L1
 * ball. Rotating into p = (s + t) / 2, q = (t - s) / 2 turns it into an
 * axis-aligned square of side 1 centred at p = col + 1, q = row - so rounding p
 * and q selects the containing diamond directly.
 */
function isometricPixelToTile(x: number, y: number, ctx: MapContext): TileCell {
  const s = x / (ctx.tilewidth / 2)
  const t = y / (ctx.tileheight / 2)
  return {
    column: Math.round((s + t) / 2) - 1,
    row: Math.round((t - s) / 2)
  }
}

/**
 * Staggered and hexagonal cells interlock, so no closed form maps a point to a
 * cell. Instead this takes the cell whose *bounding box* holds the point, then
 * tests that cell and its neighbours against their true polygon.
 *
 * Every point in the plane is inside exactly one cell polygon, and the correct
 * cell is always within one step of the bounding-box guess, so the 3x3
 * neighbourhood is exhaustive. This runs per click, not per tile, so exactness
 * beats the arithmetic a hand-derived edge test would save.
 */
function staggeredPixelToTile(x: number, y: number, ctx: MapContext): TileCell {
  const staggerX = ctx.staggeraxis === 'x'
  const guessColumn = staggerX ? Math.floor(x / columnPitch(ctx)) : Math.floor(x / ctx.tilewidth)
  const guessRow = staggerX ? Math.floor(y / ctx.tileheight) : Math.floor(y / rowPitch(ctx))

  for (let dRow = -1; dRow <= 1; dRow++) {
    for (let dColumn = -1; dColumn <= 1; dColumn++) {
      const column = guessColumn + dColumn
      const row = guessRow + dRow
      if (containsPoint(column, row, x, y, ctx)) return { column, row }
    }
  }

  return { column: guessColumn, row: guessRow }
}

function containsPoint(
  column: number,
  row: number,
  x: number,
  y: number,
  ctx: MapContext
): boolean {
  // Read x/y immediately - tileToPixel returns a reusable object.
  const anchor = tileToPixel(column, row, ctx)
  const anchorX = anchor.x
  const anchorY = anchor.y
  return pointInPolygon(x - anchorX, y - anchorY, cellPolygon(ctx))
}

/**
 * The cell outline for one tile, relative to its `tileToPixel` anchor: a diamond
 * for staggered maps, and for hexagonal maps a hexagon whose straight edges run
 * along the stagger axis with length `hexsidelength`.
 */
function cellPolygon(ctx: MapContext): TilePosition[] {
  const w = ctx.tilewidth
  const h = ctx.tileheight

  if (ctx.orientation === 'staggered') {
    return [
      { x: w / 2, y: 0 },
      { x: w, y: h / 2 },
      { x: w / 2, y: h },
      { x: 0, y: h / 2 }
    ]
  }

  const side = ctx.hexsidelength ?? 0
  if (ctx.staggeraxis === 'x') {
    // Flat-top: straight edges top and bottom.
    return [
      { x: (w - side) / 2, y: 0 },
      { x: (w + side) / 2, y: 0 },
      { x: w, y: h / 2 },
      { x: (w + side) / 2, y: h },
      { x: (w - side) / 2, y: h },
      { x: 0, y: h / 2 }
    ]
  }

  // Pointy-top: straight edges left and right.
  return [
    { x: w / 2, y: 0 },
    { x: w, y: (h - side) / 2 },
    { x: w, y: (h + side) / 2 },
    { x: w / 2, y: h },
    { x: 0, y: (h + side) / 2 },
    { x: 0, y: (h - side) / 2 }
  ]
}

/**
 * Ray casting, with a half-open edge rule: a point on a shared edge lands in
 * exactly one of the two cells, so no point resolves to two cells or none.
 */
function pointInPolygon(x: number, y: number, polygon: TilePosition[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!
    const b = polygon[j]!
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside
    }
  }
  return inside
}

function columnPitch(ctx: MapContext): number {
  return ctx.orientation === 'hexagonal'
    ? (ctx.tilewidth + (ctx.hexsidelength ?? 0)) / 2
    : ctx.tilewidth / 2
}

function rowPitch(ctx: MapContext): number {
  return ctx.orientation === 'hexagonal'
    ? (ctx.tileheight + (ctx.hexsidelength ?? 0)) / 2
    : ctx.tileheight / 2
}

/**
 * Resolves a point in map space to a tile cell, or `null` when it falls outside
 * the map's grid. Never clamps to an edge cell.
 *
 * Camera and canvas maths stay with the caller: transform a screen point into
 * the map container's local space first.
 */
export function tileAt(map: ResolvedMap, x: number, y: number): TileCell | null {
  const cell = pixelToTile(x, y, {
    orientation: map.orientation,
    renderorder: map.renderorder,
    tilewidth: map.tilewidth,
    tileheight: map.tileheight,
    hexsidelength: map.hexsidelength,
    staggeraxis: map.staggeraxis,
    staggerindex: map.staggerindex,
    skewx: map.skewx,
    skewy: map.skewy
  })

  if (cell.column < 0 || cell.column >= map.width) return null
  if (cell.row < 0 || cell.row >= map.height) return null
  return cell
}

export function getTileIterationPlan(
  layerWidth: number,
  layerHeight: number,
  ctx: Pick<MapContext, 'renderorder'>
): TileIterationPlan {
  const order = ctx.renderorder
  const rightToLeft = order === 'left-down' || order === 'left-up'
  const bottomToTop = order === 'right-up' || order === 'left-up'

  return {
    rowStart: bottomToTop ? layerHeight - 1 : 0,
    rowEnd: bottomToTop ? -1 : layerHeight,
    rowStep: bottomToTop ? -1 : 1,
    colStart: rightToLeft ? layerWidth - 1 : 0,
    colEnd: rightToLeft ? -1 : layerWidth,
    colStep: rightToLeft ? -1 : 1
  }
}

function staggeredToPixel(col: number, row: number, ctx: MapContext): TilePosition {
  const staggerX = ctx.staggeraxis === 'x'
  const staggerEven = ctx.staggerindex === 'even'

  if (staggerX) {
    const isStaggered = staggerEven ? col % 2 === 0 : col % 2 !== 0
    _pos.x = col * (ctx.tilewidth / 2)
    _pos.y = row * ctx.tileheight + (isStaggered ? ctx.tileheight / 2 : 0)
  } else {
    const isStaggered = staggerEven ? row % 2 === 0 : row % 2 !== 0
    _pos.x = col * ctx.tilewidth + (isStaggered ? ctx.tilewidth / 2 : 0)
    _pos.y = row * (ctx.tileheight / 2)
  }
  return _pos
}

function hexagonalToPixel(col: number, row: number, ctx: MapContext): TilePosition {
  const hexSide = ctx.hexsidelength ?? 0
  const staggerX = ctx.staggeraxis === 'x'
  const staggerEven = ctx.staggerindex === 'even'

  if (staggerX) {
    const colWidth = (ctx.tilewidth + hexSide) / 2
    const isStaggered = staggerEven ? col % 2 === 0 : col % 2 !== 0
    _pos.x = col * colWidth
    _pos.y = row * ctx.tileheight + (isStaggered ? ctx.tileheight / 2 : 0)
  } else {
    const rowHeight = (ctx.tileheight + hexSide) / 2
    const isStaggered = staggerEven ? row % 2 === 0 : row % 2 !== 0
    _pos.x = col * ctx.tilewidth + (isStaggered ? ctx.tilewidth / 2 : 0)
    _pos.y = row * rowHeight
  }
  return _pos
}

/**
 * Tiled draws an oblique tile unsheared, with its bottom-left corner on the
 * sheared cell's bottom-left corner. The tile renderers place a tile by the
 * top-left of an unsheared, cell-high box, so return that point.
 */
function obliqueToPixel(col: number, row: number, ctx: MapContext): TilePosition {
  const x = col * ctx.tilewidth
  const bottom = (row + 1) * ctx.tileheight
  _pos.x = x + obliqueShearX(ctx) * bottom
  _pos.y = obliqueShearY(ctx) * x + bottom - ctx.tileheight
  return _pos
}
