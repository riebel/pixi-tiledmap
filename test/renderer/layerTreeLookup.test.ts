/**
 * @vitest-environment jsdom
 *
 * The tile-layer index added in 2.8.6 must be a pure speed-up: every lookup
 * semantic that existed before it, including first-match on duplicate names,
 * has to survive unchanged.
 */
import { Container, Texture } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { TiledMap } from '../../src/renderer/TiledMap.js'
import { TileLayerRenderer } from '../../src/renderer/TileLayerRenderer.js'
import {
  makeResolvedGroupLayer,
  makeResolvedImageLayer,
  makeResolvedMap,
  makeResolvedTileLayer,
  makeResolvedTileset
} from '../helpers/resolved.js'

function mapWith(layers: ReturnType<typeof makeResolvedTileLayer>[] | unknown[], options?: object) {
  return new TiledMap(
    makeResolvedMap({
      width: 2,
      height: 2,
      tilesets: [
        makeResolvedTileset({ name: 'base', image: 'base.png', firstgid: 1, tilecount: 4 })
      ],
      // biome-ignore lint/suspicious/noExplicitAny: fixture accepts mixed layer shapes
      layers: layers as any
    }),
    { tilesetTextures: new Map([['base.png', Texture.EMPTY]]), ...options }
  )
}

const cell = () => ({ width: 2, height: 2, tiles: new Array(4).fill(null) })

describe('tile layer lookup semantics', () => {
  it('resolves layers by numeric id', () => {
    const map = mapWith([
      makeResolvedTileLayer({ id: 7, name: 'ground', ...cell() }),
      makeResolvedTileLayer({ id: 9, name: 'walls', ...cell() })
    ])

    map.setTile(9, 0, 0, 1)

    expect(map.getTile(9, 0, 0)).toMatchObject({ gid: 1 })
    expect(map.getTile(7, 0, 0)).toBeNull()
  })

  it('resolves nested layers inside groups', () => {
    const map = mapWith([
      makeResolvedGroupLayer({
        name: 'outer',
        layers: [
          makeResolvedGroupLayer({
            name: 'inner',
            layers: [makeResolvedTileLayer({ id: 3, name: 'deep', ...cell() })]
          })
        ]
      })
    ])

    map.setTile('deep', 1, 1, 1)

    expect(map.getTile('deep', 1, 1)).toMatchObject({ gid: 1 })
    expect(map.getTile(3, 1, 1)).toMatchObject({ gid: 1 })
  })

  it('keeps first-match behaviour for duplicate layer names', () => {
    const first = makeResolvedTileLayer({ id: 1, name: 'dup', ...cell() })
    const second = makeResolvedTileLayer({ id: 2, name: 'dup', ...cell() })
    const map = mapWith([first, second])

    // Must resolve to the first match and must not throw on ambiguity.
    expect(() => map.setTile('dup', 0, 0, 1)).not.toThrow()
    expect(first.tiles[0]).toMatchObject({ gid: 1 })
    expect(second.tiles[0]).toBeNull()
  })

  it('prefers a shallower duplicate over a nested one, as the walk always did', () => {
    const top = makeResolvedTileLayer({ id: 1, name: 'dup', ...cell() })
    const nested = makeResolvedTileLayer({ id: 2, name: 'dup', ...cell() })
    const map = mapWith([top, makeResolvedGroupLayer({ name: 'group', layers: [nested] })])

    map.setTile('dup', 0, 0, 1)

    expect(top.tiles[0]).toMatchObject({ gid: 1 })
    expect(nested.tiles[0]).toBeNull()
  })

  it('resolves a duplicate id to the first match', () => {
    const first = makeResolvedTileLayer({ id: 5, name: 'a', ...cell() })
    const second = makeResolvedTileLayer({ id: 5, name: 'b', ...cell() })
    const map = mapWith([first, second])

    map.setTile(5, 0, 0, 1)

    expect(first.tiles[0]).toMatchObject({ gid: 1 })
    expect(second.tiles[0]).toBeNull()
  })

  it('throws for layers that are filtered out of rendering', () => {
    const map = mapWith(
      [
        makeResolvedTileLayer({ id: 1, name: 'shown', ...cell() }),
        makeResolvedTileLayer({ id: 2, name: 'hidden', ...cell() })
      ],
      { layerFilter: (layer: { name: string }) => layer.name !== 'hidden' }
    )

    expect(() => map.setTile('hidden', 0, 0, 1)).toThrow(/not rendered/)
    expect(() => map.setTile(2, 0, 0, 1)).toThrow(/not rendered/)
    expect(() => map.setTile('shown', 0, 0, 1)).not.toThrow()
  })

  it('indexes filtered nested groups correctly', () => {
    const map = mapWith(
      [
        makeResolvedGroupLayer({
          name: 'group',
          layers: [
            makeResolvedTileLayer({ id: 1, name: 'keep', ...cell() }),
            makeResolvedTileLayer({ id: 2, name: 'drop', ...cell() })
          ]
        })
      ],
      { layerFilter: (layer: { name: string }) => layer.name !== 'drop' }
    )

    expect(() => map.setTile('keep', 0, 0, 1)).not.toThrow()
    expect(() => map.setTile('drop', 0, 0, 1)).toThrow(/not rendered/)
  })

  it('throws for unknown layers', () => {
    const map = mapWith([makeResolvedTileLayer({ id: 1, name: 'ground', ...cell() })])

    expect(() => map.setTile('nope', 0, 0, 1)).toThrow(/not rendered/)
    expect(() => map.setTile(42, 0, 0, 1)).toThrow(/not rendered/)
  })

  it('does not resolve non-tile layers through the tile lookup', () => {
    const map = mapWith([
      makeResolvedImageLayer({ id: 1, name: 'backdrop' }),
      makeResolvedTileLayer({ id: 2, name: 'ground', ...cell() })
    ])

    expect(() => map.setTile('backdrop', 0, 0, 1)).toThrow(/not rendered/)
    expect(map.getLayer('backdrop')).toBeDefined()
  })

  it('still finds a layer after the tree is mutated post-construction', () => {
    const map = mapWith([makeResolvedTileLayer({ id: 1, name: 'ground', ...cell() })])
    const extra = new TileLayerRenderer(
      makeResolvedTileLayer({ id: 2, name: 'added', ...cell() }),
      map.tileSetRenderers,
      {
        orientation: 'orthogonal',
        renderorder: 'right-down',
        tilewidth: 32,
        tileheight: 32
      }
    )
    map.addChild(extra)

    // The index cannot know about this layer, so the live walk must cover it.
    expect(() => map.setTile('added', 0, 0, 1)).not.toThrow()
    expect(map.getTile('added', 0, 0)).toMatchObject({ gid: 1 })
  })

  it('stops resolving a layer that was reparented to another container', () => {
    // A reparented layer keeps a truthy `parent`, so the index must check that
    // the hit is still part of *this* map rather than merely attached.
    const map = mapWith([makeResolvedTileLayer({ id: 1, name: 'ground', ...cell() })])
    const ground = map.getLayer('ground')!
    new Container().addChild(ground)

    expect(() => map.setTile('ground', 0, 0, 1)).toThrow(/not rendered/)
    expect(() => map.setTile(1, 0, 0, 1)).toThrow(/not rendered/)
  })

  it('follows current child order for duplicate names after a reorder', () => {
    // First-match depends on live child order, which a cached index cannot
    // track, so ambiguous selectors must keep resolving through the live walk.
    const first = makeResolvedTileLayer({ id: 1, name: 'dup', ...cell() })
    const second = makeResolvedTileLayer({ id: 2, name: 'dup', ...cell() })
    const map = mapWith([first, second])
    const secondRenderer = map.children.find(
      (child) => child instanceof TileLayerRenderer && child.layerData.id === 2
    )!
    map.setChildIndex(secondRenderer, 0)

    map.setTile('dup', 0, 0, 1)

    expect(second.tiles[0]).toMatchObject({ gid: 1 })
    expect(first.tiles[0]).toBeNull()
  })

  it('stops resolving a layer that was removed after construction', () => {
    const map = mapWith([makeResolvedTileLayer({ id: 1, name: 'ground', ...cell() })])
    const ground = map.getLayer('ground')!
    map.removeChild(ground)

    expect(() => map.setTile('ground', 0, 0, 1)).toThrow(/not rendered/)
  })

  it('keeps getLayer working for background and layer containers', () => {
    const map = mapWith([makeResolvedTileLayer({ id: 1, name: 'ground', ...cell() })])

    expect(map.getLayer('ground')).toBeInstanceOf(TileLayerRenderer)
    expect(map.getLayer('missing')).toBeUndefined()
  })
})
