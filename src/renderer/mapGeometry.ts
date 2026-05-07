import type { MapContext, ResolvedMap, TilePosition } from '../types'

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
