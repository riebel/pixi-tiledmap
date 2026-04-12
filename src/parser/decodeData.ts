import type { TiledCompression, TiledEncoding } from '../types'

export function csvToGids(csv: string): number[] {
  const out: number[] = []
  let cur = 0
  let hasDigit = false
  for (let i = 0; i < csv.length; i++) {
    const code = csv.charCodeAt(i)
    if (code >= 48 && code <= 57) {
      cur = cur * 10 + (code - 48)
      hasDigit = true
    } else if (code === 44) {
      // ','
      if (hasDigit) out.push(cur)
      cur = 0
      hasDigit = false
    }
    // whitespace / newlines: ignore
  }
  if (hasDigit) out.push(cur)
  return out
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

function decodeBase64Sync(data: string, compression?: TiledCompression): number[] {
  const bytes = base64ToBytes(data)

  if (compression === 'gzip' || compression === 'zlib') {
    throw new Error(
      `Compressed tile data (${compression}) requires the async parser. ` +
        'Use parseMapAsync() instead of parseMap() for compressed maps.'
    )
  }

  if (compression === 'zstd') {
    throw new Error('zstd compression is not supported in the browser')
  }

  return bytesToGids(bytes)
}

async function decodeBase64Async(data: string, compression?: TiledCompression): Promise<number[]> {
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

export function decodeLayerData(
  data: number[] | string,
  encoding?: TiledEncoding,
  compression?: TiledCompression
): number[] {
  if (Array.isArray(data)) return data
  if (encoding === 'csv') return csvToGids(data)
  if (encoding === 'base64') return decodeBase64Sync(data, compression)
  throw new Error(`Unsupported encoding: ${encoding ?? 'unknown'}`)
}

export async function decodeLayerDataAsync(
  data: number[] | string,
  encoding?: TiledEncoding,
  compression?: TiledCompression
): Promise<number[]> {
  if (Array.isArray(data)) return data
  if (encoding === 'csv') return csvToGids(data)
  if (encoding === 'base64') return decodeBase64Async(data, compression)
  throw new Error(`Unsupported encoding: ${encoding ?? 'unknown'}`)
}
