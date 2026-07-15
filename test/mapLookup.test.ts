import { describe, expect, it } from 'vitest'
import { findLayer, findLayerById, getProperty, walkLayers } from '../src/mapLookup.js'
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
