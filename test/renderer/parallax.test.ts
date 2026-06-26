/**
 * @vitest-environment jsdom
 */
import { Texture, TilingSprite } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { TiledMap } from '../../src/renderer/TiledMap.js'
import {
  makeResolvedGroupLayer,
  makeResolvedImageLayer,
  makeResolvedMap
} from '../helpers/resolved.js'

describe('TiledMap.applyParallax', () => {
  it('leaves layers at base offset when camera is at origin', () => {
    const map = new TiledMap(
      makeResolvedMap({
        layers: [
          makeResolvedImageLayer({
            id: 1,
            name: 'bg',
            offsetx: 10,
            offsety: 20,
            parallaxx: 0.5,
            parallaxy: 0.5
          })
        ]
      })
    )

    map.applyParallax(0, 0)
    const layer = map.getLayer('bg')!
    expect(layer.position.x).toBe(10)
    expect(layer.position.y).toBe(20)
  })

  it('pins a parallax-0 layer in screen space as camera moves', () => {
    const map = new TiledMap(
      makeResolvedMap({
        layers: [
          makeResolvedImageLayer({
            id: 1,
            name: 'sky',
            parallaxx: 0,
            parallaxy: 0
          })
        ]
      })
    )

    map.applyParallax(100, 50)
    const layer = map.getLayer('sky')!
    // base + (camera - origin) * (1 - 0) = 0 + 100 = 100
    expect(layer.position.x).toBe(100)
    expect(layer.position.y).toBe(50)
  })

  it('moves a parallax-1 layer with the camera (net zero offset shift)', () => {
    const map = new TiledMap(
      makeResolvedMap({
        layers: [
          makeResolvedImageLayer({
            id: 1,
            name: 'world',
            offsetx: 5,
            offsety: 5
          })
        ]
      })
    )

    map.applyParallax(200, 300)
    const layer = map.getLayer('world')!
    // base + (camera - origin) * (1 - 1) = 5 + 0 = 5 (unchanged)
    expect(layer.position.x).toBe(5)
    expect(layer.position.y).toBe(5)
  })

  it('applies half-speed parallax at 0.5 factor', () => {
    const map = new TiledMap(
      makeResolvedMap({
        layers: [
          makeResolvedImageLayer({
            id: 1,
            name: 'mid',
            parallaxx: 0.5,
            parallaxy: 0.25
          })
        ]
      })
    )

    map.applyParallax(100, 100)
    const layer = map.getLayer('mid')!
    // 0 + (100 - 0) * (1 - 0.5) = 50
    expect(layer.position.x).toBe(50)
    // 0 + (100 - 0) * (1 - 0.25) = 75
    expect(layer.position.y).toBe(75)
  })

  it('honours parallaxoriginx/y', () => {
    const map = new TiledMap(
      makeResolvedMap({
        parallaxoriginx: 40,
        parallaxoriginy: 80,
        layers: [
          makeResolvedImageLayer({
            id: 1,
            name: 'bg',
            parallaxx: 0,
            parallaxy: 0
          })
        ]
      })
    )

    map.applyParallax(100, 100)
    const layer = map.getLayer('bg')!
    // (100 - 40) * 1 = 60, (100 - 80) * 1 = 20
    expect(layer.position.x).toBe(60)
    expect(layer.position.y).toBe(20)
  })

  it('composes parallax multiplicatively through group layers', () => {
    const map = new TiledMap(
      makeResolvedMap({
        layers: [
          makeResolvedGroupLayer({
            id: 1,
            name: 'outer',
            parallaxx: 0.5,
            parallaxy: 0.5,
            layers: [
              makeResolvedImageLayer({
                id: 2,
                name: 'inner',
                parallaxx: 0.5,
                parallaxy: 0.5
              })
            ]
          })
        ]
      })
    )

    map.applyParallax(100, 100)
    const outer = map.getLayer('outer')!
    const inner = outer.children.find((c) => c.label === 'inner')!
    // outer: 0 + 100 * (1 - 0.5) = 50
    expect(outer.position.x).toBe(50)
    // inner effective parallax = 0.5 * 0.5 = 0.25 → 100 * (1 - 0.25) = 75
    expect(inner.position.x).toBe(75)
  })

  it('keeps repeated image layers covering the camera while scrolling the tiled texture', () => {
    const map = new TiledMap(
      makeResolvedMap({
        width: 4,
        height: 2,
        tilewidth: 32,
        tileheight: 32,
        layers: [
          makeResolvedImageLayer({
            id: 1,
            name: 'clouds',
            image: 'clouds.png',
            repeatx: true,
            parallaxx: 0.5
          })
        ]
      }),
      {
        imageLayerTextures: new Map([['clouds.png', Texture.EMPTY]])
      }
    )

    const layer = map.getLayer('clouds')!
    const tiledImage = layer.children[0]
    expect(tiledImage).toBeInstanceOf(TilingSprite)

    map.applyParallax(64, 0)

    expect(layer.position.x).toBe(64)
    expect((tiledImage as TilingSprite).tilePosition.x).toBe(-32)
  })
})
