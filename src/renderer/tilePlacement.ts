import type { MapContext, TilePosition } from '../types'

export function tileToPixel(col: number, row: number, ctx: MapContext): TilePosition {
  switch (ctx.orientation) {
    case 'orthogonal':
      return orthogonalToPixel(col, row, ctx)
    case 'isometric':
      return isometricToPixel(col, row, ctx)
    case 'staggered':
      return staggeredToPixel(col, row, ctx)
    case 'hexagonal':
      return hexagonalToPixel(col, row, ctx)
  }
}

// ─── Orthogonal ──────────────────────────────────────────────────────────────

function orthogonalToPixel(col: number, row: number, ctx: MapContext): TilePosition {
  return {
    x: col * ctx.tilewidth,
    y: row * ctx.tileheight
  }
}

// ─── Isometric (diamond) ─────────────────────────────────────────────────────

function isometricToPixel(col: number, row: number, ctx: MapContext): TilePosition {
  const halfW = ctx.tilewidth / 2
  const halfH = ctx.tileheight / 2
  return {
    x: (col - row) * halfW,
    y: (col + row) * halfH
  }
}

// ─── Staggered (isometric staggered) ─────────────────────────────────────────

function staggeredToPixel(col: number, row: number, ctx: MapContext): TilePosition {
  const staggerX = ctx.staggeraxis === 'x'
  const staggerEven = ctx.staggerindex === 'even'

  if (staggerX) {
    const isStaggered = staggerEven ? col % 2 === 0 : col % 2 !== 0
    return {
      x: col * (ctx.tilewidth / 2),
      y: row * ctx.tileheight + (isStaggered ? ctx.tileheight / 2 : 0)
    }
  }

  // stagger Y (default)
  const isStaggered = staggerEven ? row % 2 === 0 : row % 2 !== 0
  return {
    x: col * ctx.tilewidth + (isStaggered ? ctx.tilewidth / 2 : 0),
    y: row * (ctx.tileheight / 2)
  }
}

// ─── Hexagonal ───────────────────────────────────────────────────────────────

function hexagonalToPixel(col: number, row: number, ctx: MapContext): TilePosition {
  const hexSide = ctx.hexsidelength ?? 0
  const staggerX = ctx.staggeraxis === 'x'
  const staggerEven = ctx.staggerindex === 'even'

  if (staggerX) {
    const colWidth = (ctx.tilewidth + hexSide) / 2
    const isStaggered = staggerEven ? col % 2 === 0 : col % 2 !== 0
    return {
      x: col * colWidth,
      y: row * ctx.tileheight + (isStaggered ? ctx.tileheight / 2 : 0)
    }
  }

  // stagger Y (default for hex)
  const rowHeight = (ctx.tileheight + hexSide) / 2
  const isStaggered = staggerEven ? row % 2 === 0 : row % 2 !== 0
  return {
    x: col * ctx.tilewidth + (isStaggered ? ctx.tilewidth / 2 : 0),
    y: row * rowHeight
  }
}
