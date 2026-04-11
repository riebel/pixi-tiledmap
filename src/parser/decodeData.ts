import type { TiledCompression, TiledEncoding } from '../types'

export function decodeLayerData(
  data: number[] | string,
  encoding?: TiledEncoding,
  compression?: TiledCompression
): number[] {
  if (Array.isArray(data)) {
    return data
  }

  if (encoding === 'base64') {
    const bytes = base64ToBytes(data)

    if (compression === 'gzip' || compression === 'zlib') {
      const decompressed = decompressBytes(bytes, compression)
      return bytesToGids(decompressed)
    }

    if (compression === 'zstd') {
      throw new Error('zstd compression is not supported in the browser')
    }

    return bytesToGids(bytes)
  }

  throw new Error(`Unsupported encoding: ${encoding ?? 'unknown'}`)
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = globalThis.atob(base64.trim())
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function bytesToGids(bytes: Uint8Array): number[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const count = bytes.byteLength / 4
  const gids: number[] = new Array(count)

  for (let i = 0; i < count; i++) {
    gids[i] = view.getUint32(i * 4, true)
  }

  return gids
}

async function decompressBytesAsync(
  bytes: Uint8Array,
  compression: 'gzip' | 'zlib'
): Promise<Uint8Array> {
  const format = compression === 'gzip' ? 'gzip' : 'deflate'
  const ds = new DecompressionStream(format)
  const writer = ds.writable.getWriter()
  writer.write(bytes as Uint8Array<ArrayBuffer>)
  writer.close()

  const reader = ds.readable.getReader()
  const chunks: Uint8Array[] = []
  let totalLength = 0

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    totalLength += value.byteLength
  }

  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.byteLength
  }
  return result
}

function decompressBytes(_bytes: Uint8Array, compression: 'gzip' | 'zlib'): Uint8Array {
  if (typeof DecompressionStream !== 'undefined') {
    // Synchronous wrapper is not possible for DecompressionStream.
    // We throw here — the async path should be used instead.
    throw new Error(
      `Compressed tile data (${compression}) requires the async parser. ` +
        'Use parseMapAsync() instead of parseMap() for compressed maps.'
    )
  }

  throw new Error(
    `Compressed tile data (${compression}) is not supported in this environment. ` +
      'DecompressionStream API is required.'
  )
}

export async function decodeLayerDataAsync(
  data: number[] | string,
  encoding?: TiledEncoding,
  compression?: TiledCompression
): Promise<number[]> {
  if (Array.isArray(data)) {
    return data
  }

  if (encoding === 'base64') {
    const bytes = base64ToBytes(data)

    if (compression === 'gzip' || compression === 'zlib') {
      const decompressed = await decompressBytesAsync(bytes, compression)
      return bytesToGids(decompressed)
    }

    if (compression === 'zstd') {
      throw new Error('zstd compression is not supported in the browser')
    }

    return bytesToGids(bytes)
  }

  throw new Error(`Unsupported encoding: ${encoding ?? 'unknown'}`)
}
