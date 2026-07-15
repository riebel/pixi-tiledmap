/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from 'vitest'
import { GroupLayerRenderer } from '../../src/index.js'
import type { MapContext } from '../../src/types/index.js'
import { makeResolvedGroupLayer, makeResolvedTileLayer } from '../helpers/resolved.js'

const mapContext: MapContext = {
  orientation: 'orthogonal',
  renderorder: 'right-down',
  tilewidth: 16,
  tileheight: 16
}

describe('GroupLayerRenderer public constructor', () => {
  it('accepts the 2.8.5 context shape and recursively renders matching descendants', () => {
    const layer = makeResolvedGroupLayer({
      name: 'root',
      layers: [
        makeResolvedGroupLayer({
          id: 2,
          name: 'nested',
          layers: [makeResolvedTileLayer({ id: 3, name: 'kept' })]
        }),
        makeResolvedTileLayer({ id: 4, name: 'filtered-out' })
      ]
    })

    const renderer = new GroupLayerRenderer(layer, {
      tilesets: [],
      mapContext,
      imageTextures: new Map(),
      layerFilter: (candidate) => candidate.name === 'kept'
    })

    expect(renderer.label).toBe('root')
    expect(renderer.children.map((child) => child.label)).toEqual(['nested'])
    expect(renderer.children[0]?.children.map((child) => child.label)).toEqual(['kept'])
  })
})
