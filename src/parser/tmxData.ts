import type { TiledChunk, TiledCompression, TiledEncoding } from '../types'
import { csvToGids } from './decodeData.js'
import { children, int, optStr } from './xmlHelpers.js'

export function parseData(dataEl: Element): {
  data?: number[] | string
  encoding?: TiledEncoding
  compression?: TiledCompression
  chunks?: TiledChunk[]
} {
  const encoding = optStr(dataEl, 'encoding') as TiledEncoding | undefined
  const compression = optStr(dataEl, 'compression') as TiledCompression | undefined

  const chunkEls = children(dataEl, 'chunk')
  if (chunkEls.length > 0) {
    const chunks: TiledChunk[] = chunkEls.map((c) => ({
      x: int(c, 'x'),
      y: int(c, 'y'),
      width: int(c, 'width'),
      height: int(c, 'height'),
      data: parseDataContent(c, encoding)
    }))
    return { encoding, compression, chunks }
  }

  return {
    data: parseDataContent(dataEl, encoding),
    encoding,
    compression
  }
}

function parseDataContent(el: Element, encoding: TiledEncoding | undefined): number[] | string {
  if (encoding === 'base64') {
    return (el.textContent ?? '').trim()
  }

  if (encoding === 'csv') {
    return csvToGids(el.textContent ?? '')
  }

  const tileEls = children(el, 'tile')
  return tileEls.map((t) => int(t, 'gid'))
}
