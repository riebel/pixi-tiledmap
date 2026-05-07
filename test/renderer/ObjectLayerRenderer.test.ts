/**
 * @vitest-environment jsdom
 */
import { type Sprite, Texture } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { ObjectLayerRenderer } from '../../src/renderer/ObjectLayerRenderer.js'
import { TileSetRenderer } from '../../src/renderer/TileSetRenderer.js'
import type { ResolvedTileset } from '../../src/types/index.js'
import { makeResolvedObjectLayer, makeResolvedTileset } from '../helpers/resolved.js'

function makeTileset(overrides?: Partial<ResolvedTileset>): TileSetRenderer {
  const renderer = new TileSetRenderer(makeResolvedTileset(overrides), null)
  renderer.setTileTexture(0, Texture.EMPTY)
  return renderer
}

describe('ObjectLayerRenderer tile objects', () => {
  it('composes object rotation with diagonal tile flip rotation', () => {
    const layer = makeResolvedObjectLayer({
      objects: [
        {
          id: 1,
          name: '',
          type: '',
          x: 0,
          y: 32,
          width: 32,
          height: 32,
          rotation: 45,
          visible: true,
          tile: {
            gid: 1,
            localId: 0,
            tilesetIndex: 0,
            horizontalFlip: true,
            verticalFlip: false,
            diagonalFlip: true
          }
        }
      ]
    })

    const renderer = new ObjectLayerRenderer(layer, [makeTileset()])
    const sprite = renderer.children[0] as Sprite

    expect(sprite.angle).toBeCloseTo(135)
  })
})
