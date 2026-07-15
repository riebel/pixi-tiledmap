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
  const { orientation, width, height, tilewidth, tileheight, staggeraxis } = mapData

  switch (orientation) {
    case 'isometric':
      return {
        width: (width + height) * (tilewidth / 2),
        height: (width + height) * (tileheight / 2)
      }
    case 'staggered':
    case 'hexagonal':
      return staggeraxis === 'x'
        ? {
            width: (width + 1) * (tilewidth / 2),
            height: height * tileheight + tileheight / 2
          }
        : {
            width: width * tilewidth + tilewidth / 2,
            height: (height + 1) * (tileheight / 2)
          }
    default:
      return { width: width * tilewidth, height: height * tileheight }
  }
}

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
    staggerindex: map.staggerindex
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
