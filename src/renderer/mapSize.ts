import type { ResolvedMap } from '../types'

export function computeMapPixelSize(mapData: ResolvedMap): { width: number; height: number } {
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
