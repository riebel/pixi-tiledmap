/**
 * @vitest-environment jsdom
 *
 * Animated map tiles are driven by one ticker listener per layer instead of
 * PixiJS' per-sprite `autoUpdate`. See docs/BENCHMARKS.md.
 */
import { type AnimatedSprite, Texture, Ticker } from 'pixi.js'
import { describe, expect, it, vi } from 'vitest'
import { TileLayerRenderer } from '../../src/renderer/TileLayerRenderer.js'
import { TileSetRenderer } from '../../src/renderer/TileSetRenderer.js'
import type { MapContext } from '../../src/types/index.js'
import {
  makeResolvedTile,
  makeResolvedTileLayer,
  makeResolvedTileset
} from '../helpers/resolved.js'

const ctx: MapContext = {
  orientation: 'orthogonal',
  renderorder: 'right-down',
  tilewidth: 32,
  tileheight: 32,
  tileSpritePadding: 0
}

/** A two-frame animation over two atlas tiles, so a frame change is observable. */
function animatedTileset() {
  return new TileSetRenderer(
    makeResolvedTileset({
      columns: 2,
      tilecount: 4,
      tiles: new Map([
        [
          0,
          {
            id: 0,
            animation: [
              { tileid: 0, duration: 100 },
              { tileid: 1, duration: 100 }
            ]
          }
        ]
      ])
    }),
    Texture.EMPTY
  )
}

function animatedLayer(size: number) {
  return makeResolvedTileLayer({
    width: size,
    height: size,
    tiles: Array.from({ length: size * size }, () => makeResolvedTile())
  })
}

describe('animated tile visuals', () => {
  it('adds one ticker listener per layer, whatever the tile count', () => {
    const before = Ticker.shared.count

    const renderer = new TileLayerRenderer(animatedLayer(8), [animatedTileset()], ctx)

    expect(renderer.children).toHaveLength(64)
    expect(Ticker.shared.count).toBe(before + 1)
    expect((renderer.children[0] as AnimatedSprite).autoUpdate).toBe(false)

    renderer.destroy({ children: true })

    expect(Ticker.shared.count).toBe(before)
  })

  it('advances its tiles when the shared ticker updates', () => {
    const renderer = new TileLayerRenderer(animatedLayer(1), [animatedTileset()], ctx)
    const sprite = renderer.children[0] as AnimatedSprite
    const firstFrameTexture = sprite.texture

    // 100ms of ticker time is exactly the first frame's duration.
    Ticker.shared.update(performance.now())
    Ticker.shared.update(performance.now() + 100)

    expect(sprite.currentFrame).toBe(1)
    expect(sprite.texture).not.toBe(firstFrameTexture)

    renderer.destroy({ children: true })
  })

  it('stops advancing tiles of a destroyed layer', () => {
    const renderer = new TileLayerRenderer(animatedLayer(1), [animatedTileset()], ctx)
    const sprite = renderer.children[0] as AnimatedSprite
    const update = vi.spyOn(sprite, 'update')

    Ticker.shared.update(performance.now())
    expect(update).toHaveBeenCalled()

    renderer.destroy()
    update.mockClear()
    Ticker.shared.update(performance.now() + 100)

    expect(update).not.toHaveBeenCalled()
  })

  it('drives the tiles a rebuild creates, without leaking a listener', () => {
    const before = Ticker.shared.count
    const renderer = new TileLayerRenderer(animatedLayer(2), [animatedTileset()], ctx)

    // Painting an animated tile into a cleared cell rebuilds the layer.
    renderer.clearTile(0, 0)
    renderer.setTile(0, 0, makeResolvedTile())

    expect(Ticker.shared.count).toBe(before + 1)
    const sprite = renderer.children[0] as AnimatedSprite
    const update = vi.spyOn(sprite, 'update')
    Ticker.shared.update(performance.now())

    expect(update).toHaveBeenCalled()

    renderer.destroy({ children: true })
    expect(Ticker.shared.count).toBe(before)
  })

  it('leaves a sprite the caller reconnected to the shared ticker alone', () => {
    const renderer = new TileLayerRenderer(animatedLayer(1), [animatedTileset()], ctx)
    const sprite = renderer.children[0] as AnimatedSprite
    sprite.autoUpdate = true
    // PixiJS' own listener holds the original method, so only a call through
    // the sprite - the layer's driver - reaches the spy.
    const update = vi.spyOn(sprite, 'update')

    Ticker.shared.update(performance.now())
    Ticker.shared.update(performance.now() + 100)

    expect(update).not.toHaveBeenCalled()
    // PixiJS' listener alone advanced it, so it is not updated twice per tick.
    expect(sprite.currentFrame).toBe(1)

    renderer.destroy({ children: true })
  })
})
