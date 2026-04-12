import type { MapContext, TilePosition } from '../types'

// Reusable output object — avoids allocating a { x, y } per tile.
// Safe because callers consume the values before the next call.
const _pos: TilePosition = { x: 0, y: 0 }

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

// ─── Staggered (isometric staggered) ─────────────────────────────────────────

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

// ─── Hexagonal ───────────────────────────────────────────────────────────────

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
