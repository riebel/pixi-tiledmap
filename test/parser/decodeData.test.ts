import { describe, expect, it } from 'vitest'
import { decodeLayerData, decodeLayerDataAsync } from '../../src/parser/decodeData.js'

describe('decodeLayerData', () => {
  it('returns array data unchanged', () => {
    const data = [1, 2, 0, 3]
    expect(decodeLayerData(data)).toEqual([1, 2, 0, 3])
  })

  it('decodes base64-encoded uncompressed data', () => {
    // 4 tiles: GID 1, 2, 3, 0 as little-endian uint32
    const buf = new ArrayBuffer(16)
    const view = new DataView(buf)
    view.setUint32(0, 1, true)
    view.setUint32(4, 2, true)
    view.setUint32(8, 3, true)
    view.setUint32(12, 0, true)

    const bytes = new Uint8Array(buf)
    const base64 = btoa(String.fromCharCode(...bytes))

    const result = decodeLayerData(base64, 'base64')
    expect(result).toEqual([1, 2, 3, 0])
  })

  it('decodes csv-encoded data', () => {
    const result = decodeLayerData('1,2,3,0', 'csv')
    expect(result).toEqual([1, 2, 3, 0])
  })

  it('decodes csv with whitespace and newlines', () => {
    const result = decodeLayerData('1,\n2, 3,\n0', 'csv')
    expect(result).toEqual([1, 2, 3, 0])
  })

  it('decodes csv with high-bit flip flags', () => {
    // 0x80000001 = 2147483649
    const result = decodeLayerData('2147483649,1', 'csv')
    expect(result).toEqual([2147483649, 1])
  })

  it('throws for unsupported encoding', () => {
    expect(() => decodeLayerData('data', undefined)).toThrow('Unsupported encoding')
  })

  it('throws for zstd compression', () => {
    const buf = new ArrayBuffer(4)
    const view = new DataView(buf)
    view.setUint32(0, 1, true)
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)))

    expect(() => decodeLayerData(base64, 'base64', 'zstd')).toThrow('zstd')
  })
})

describe('decodeLayerDataAsync', () => {
  it('returns array data unchanged', async () => {
    const data = [10, 20, 0]
    expect(await decodeLayerDataAsync(data)).toEqual([10, 20, 0])
  })

  it('decodes base64-encoded uncompressed data', async () => {
    const buf = new ArrayBuffer(8)
    const view = new DataView(buf)
    view.setUint32(0, 99, true)
    view.setUint32(4, 100, true)

    const bytes = new Uint8Array(buf)
    const base64 = btoa(String.fromCharCode(...bytes))

    const result = await decodeLayerDataAsync(base64, 'base64')
    expect(result).toEqual([99, 100])
  })
})
