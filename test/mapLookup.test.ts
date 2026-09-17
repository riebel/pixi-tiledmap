import { describe, expect, it } from 'vitest'
import { findLayer, findLayerById, getProperty, walkLayers } from '../src/mapLookup.js'
import type {
  TiledClassValue,
  TiledListItem,
  TiledProperty,
  TiledPropertyValue
} from '../src/types/index.js'
import {
  makeResolvedGroupLayer,
  makeResolvedMap,
  makeResolvedObjectLayer,
  makeResolvedTileLayer
} from './helpers/resolved.js'

function nestedMap() {
  return makeResolvedMap({
    properties: [
      { name: 'theme', type: 'string', value: 'castle' },
      { name: 'difficulty', type: 'int', value: 4 },
      { name: 'night', type: 'bool', value: false }
    ],
    layers: [
      makeResolvedTileLayer({ id: 1, name: 'ground' }),
      makeResolvedGroupLayer({
        id: 2,
        name: 'outer',
        layers: [
          makeResolvedGroupLayer({
            id: 3,
            name: 'inner',
            layers: [makeResolvedTileLayer({ id: 4, name: 'buried' })]
          }),
          makeResolvedObjectLayer({ id: 5, name: 'actors' })
        ]
      })
    ]
  })
}

describe('walkLayers', () => {
  it('yields group layers as well as their children, depth-first', () => {
    expect([...walkLayers(nestedMap())].map((layer) => layer.name)).toEqual([
      'ground',
      'outer',
      'inner',
      'buried',
      'actors'
    ])
  })

  it('walks a group layer directly', () => {
    const group = makeResolvedGroupLayer({
      layers: [makeResolvedTileLayer({ name: 'child' })]
    })
    expect([...walkLayers(group)].map((layer) => layer.name)).toEqual(['child'])
  })
})

describe('findLayer', () => {
  it('finds a top-level layer', () => {
    expect(findLayer(nestedMap(), 'ground')?.id).toBe(1)
  })

  it('finds a layer nested inside group layers', () => {
    expect(findLayer(nestedMap(), 'buried')?.id).toBe(4)
    expect(findLayer(nestedMap(), 'actors')?.id).toBe(5)
  })

  it('finds a group layer itself', () => {
    expect(findLayer(nestedMap(), 'inner')?.type).toBe('group')
  })

  it('returns undefined for an unknown name', () => {
    expect(findLayer(nestedMap(), 'nope')).toBeUndefined()
  })

  it('returns the first match in depth-first order', () => {
    const map = makeResolvedMap({
      layers: [
        makeResolvedGroupLayer({
          id: 1,
          name: 'group',
          layers: [makeResolvedTileLayer({ id: 2, name: 'dup' })]
        }),
        makeResolvedTileLayer({ id: 3, name: 'dup' })
      ]
    })
    expect(findLayer(map, 'dup')?.id).toBe(2)
  })
})

describe('findLayerById', () => {
  it('finds a nested layer by id', () => {
    expect(findLayerById(nestedMap(), 4)?.name).toBe('buried')
  })

  it('returns undefined for an unknown id', () => {
    expect(findLayerById(nestedMap(), 99)).toBeUndefined()
  })
})

describe('getProperty', () => {
  it('reads property values by name', () => {
    const map = nestedMap()
    expect(getProperty(map, 'theme')).toBe('castle')
    expect(getProperty(map, 'difficulty')).toBe(4)
  })

  it('returns a false value rather than treating it as missing', () => {
    expect(getProperty(nestedMap(), 'night')).toBe(false)
  })

  it('returns undefined for an unknown property', () => {
    expect(getProperty(nestedMap(), 'nope')).toBeUndefined()
  })

  it('accepts a holder with no properties at all', () => {
    expect(getProperty({}, 'theme')).toBeUndefined()
  })

  it('reads properties off layers and objects, not just maps', () => {
    const layer = makeResolvedTileLayer({
      properties: [{ name: 'solid', type: 'bool', value: true }]
    })
    expect(getProperty(layer, 'solid')).toBe(true)
  })
})

describe('getProperty narrowing', () => {
  const holder = {
    properties: [
      { name: 'theme', type: 'string', value: 'castle' },
      { name: 'tint', type: 'color', value: '#ff0000' },
      { name: 'atlas', type: 'file', value: 'tiles.png' },
      { name: 'difficulty', type: 'int', value: 4 },
      { name: 'scale', type: 'float', value: 1.5 },
      { name: 'spawn', type: 'object', value: 12 },
      { name: 'night', type: 'bool', value: false }
    ] satisfies TiledProperty[]
  }

  it('narrows string-valued types to string', () => {
    const theme: string | undefined = getProperty(holder, 'theme', 'string')
    expect(theme).toBe('castle')
    expect(getProperty(holder, 'tint', 'color')).toBe('#ff0000')
    expect(getProperty(holder, 'atlas', 'file')).toBe('tiles.png')
  })

  it('narrows number-valued types to number', () => {
    const difficulty: number | undefined = getProperty(holder, 'difficulty', 'int')
    expect(difficulty).toBe(4)
    expect(getProperty(holder, 'scale', 'float')).toBe(1.5)
    expect(getProperty(holder, 'spawn', 'object')).toBe(12)
  })

  it('narrows bool to boolean, keeping a false value', () => {
    const night: boolean | undefined = getProperty(holder, 'night', 'bool')
    expect(night).toBe(false)
  })

  it('reads a property whose type is omitted as a string, which is Tiled default', () => {
    // A .tmj read from disk may carry no type at all for a string property.
    const fromDisk = { properties: [{ name: 'theme', value: 'castle' } as TiledProperty] }
    expect(getProperty(fromDisk, 'theme', 'string')).toBe('castle')
  })

  it('returns undefined when the declared type is not the requested one', () => {
    expect(getProperty(holder, 'difficulty', 'string')).toBeUndefined()
    expect(getProperty(holder, 'theme', 'int')).toBeUndefined()
    expect(getProperty(holder, 'night', 'string')).toBeUndefined()
  })

  it('does not distinguish int from float by value alone', () => {
    // Both are numbers at runtime; the declaration is what separates them.
    expect(getProperty(holder, 'scale', 'int')).toBeUndefined()
    expect(getProperty(holder, 'difficulty', 'float')).toBeUndefined()
  })

  it('returns undefined when a value contradicts its own declared type', () => {
    // Malformed input: declared int, but the value is a string. Returning it
    // would make the narrowed `number | undefined` a lie.
    const malformed = { properties: [{ name: 'n', type: 'int', value: '4' } as TiledProperty] }
    expect(getProperty(malformed, 'n', 'int')).toBeUndefined()
  })

  it('returns undefined for an unknown name even with a type', () => {
    expect(getProperty(holder, 'nope', 'string')).toBeUndefined()
  })

  it('narrows class and list properties to their structured values', () => {
    const structured = {
      properties: [
        { name: 'stats', type: 'class', propertytype: 'Stats', value: { hp: 5 } },
        { name: 'loot', type: 'list', value: [{ type: 'int', value: 3 }] },
        { name: 'broken', type: 'class', value: [] }
      ] satisfies TiledProperty[]
    }

    const stats: TiledClassValue | undefined = getProperty(structured, 'stats', 'class')
    expect(stats).toEqual({ hp: 5 })
    const loot: TiledListItem[] | undefined = getProperty(structured, 'loot', 'list')
    expect(loot).toEqual([{ type: 'int', value: 3 }])
    expect(getProperty(structured, 'broken', 'class')).toBeUndefined()
  })

  it('still returns the raw value when no type is requested', () => {
    const value: TiledPropertyValue | undefined = getProperty(holder, 'difficulty')
    expect(value).toBe(4)
  })
})
