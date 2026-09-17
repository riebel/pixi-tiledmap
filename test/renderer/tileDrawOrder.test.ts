/**
 * @vitest-environment jsdom
 */
import { BufferImageSource, type Container, Mesh, Texture, type TextureSource } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { PackedTileLayerRenderer } from '../../src/renderer/PackedTileLayerRenderer.js'
import { TileLayerRenderer } from '../../src/renderer/TileLayerRenderer.js'
import { TileSetRenderer } from '../../src/renderer/TileSetRenderer.js'
import type { MapContext, ResolvedTile, TiledTileDefinition } from '../../src/types/index.js'
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

interface DrawnVisual {
  source: TextureSource
  x: number
  y: number
  sprite: boolean
}

function makeTexture(width: number, height: number): Texture {
  return new Texture({
    source: new BufferImageSource({
      resource: new Uint8Array(width * height * 4),
      width,
      height
    })
  })
}

function makeTileset(
  tileheight: number,
  tiles: Map<number, TiledTileDefinition> = new Map()
): TileSetRenderer {
  const renderer = new TileSetRenderer(makeResolvedTileset({ tileheight, tiles }), null)
  renderer.setTileTexture(0, makeTexture(32, tileheight))
  return renderer
}

function tileFrom(tilesetIndex: number): ResolvedTile {
  return makeResolvedTile({ tilesetIndex })
}

/** Every packed quad and tile sprite, in the order PixiJS draws them. */
function drawnVisuals(renderer: Container): DrawnVisual[] {
  const visuals: DrawnVisual[] = []
  for (const child of renderer.children) {
    if (child instanceof Mesh) {
      const positions = child.geometry.positions
      for (let offset = 0; offset < positions.length; offset += 8) {
        if (positions[offset + 2] === positions[offset]) continue
        visuals.push({
          source: child.texture.source,
          x: positions[offset]!,
          y: positions[offset + 1]!,
          sprite: false
        })
      }
    } else {
      const sprite = child as Container & { texture: Texture }
      visuals.push({ source: sprite.texture.source, x: child.x, y: child.y, sprite: true })
    }
  }
  return visuals
}

describe('packed tile draw order', () => {
  it('draws an oversized tile over an earlier tile from another tileset', () => {
    // Tileset 0 holds 32x96 tables, tileset 1 a 32x32 barrel. The table at
    // (1, 2) reaches up over the barrel at (1, 0) and must cover it, even
    // though a table in an earlier cell made its tileset's mesh the first one.
    const tables = makeTileset(96)
    const barrels = makeTileset(32)
    const renderer = new TileLayerRenderer(
      makeResolvedTileLayer({
        width: 2,
        height: 3,
        tiles: [tileFrom(0), tileFrom(1), null, null, null, tileFrom(0)]
      }),
      [tables, barrels],
      ctx
    )

    const visuals = drawnVisuals(renderer)
    const barrel = visuals.findIndex((visual) => visual.source === barrels.getTexture(0)!.source)
    const coveringTable = visuals.findIndex(
      (visual) => visual.x === 32 && visual.source === tables.getTexture(0)!.source
    )

    expect(visuals).toHaveLength(3)
    expect(barrel).toBeLessThan(coveringTable)
  })

  it('keeps one mesh per tileset while tiles stay inside their cells', () => {
    const renderer = new TileLayerRenderer(
      makeResolvedTileLayer({
        width: 4,
        height: 1,
        tiles: [tileFrom(0), tileFrom(1), tileFrom(0), tileFrom(1)]
      }),
      [makeTileset(32), makeTileset(32)],
      ctx
    )

    expect(renderer.children).toHaveLength(2)
  })

  it('draws an oversized animated tile over the static tile it covers', () => {
    const animation = new Map<number, TiledTileDefinition>([
      [
        0,
        {
          id: 0,
          animation: [
            { tileid: 0, duration: 100 },
            { tileid: 0, duration: 100 }
          ]
        }
      ]
    ])
    const ground = makeTileset(32)
    const torches = makeTileset(96, animation)
    const renderer = new TileLayerRenderer(
      makeResolvedTileLayer({
        width: 1,
        height: 3,
        tiles: [tileFrom(0), null, tileFrom(1)]
      }),
      [ground, torches],
      ctx
    )

    expect(drawnVisuals(renderer).map((visual) => visual.sprite)).toEqual([false, true])
  })

  it('draws a static tile over an earlier animated tile it covers', () => {
    const animation = new Map<number, TiledTileDefinition>([
      [
        0,
        {
          id: 0,
          animation: [
            { tileid: 0, duration: 100 },
            { tileid: 0, duration: 100 }
          ]
        }
      ]
    ])
    const water = makeTileset(32, animation)
    const tables = makeTileset(96)
    const renderer = new TileLayerRenderer(
      makeResolvedTileLayer({
        width: 2,
        height: 3,
        tiles: [tileFrom(1), tileFrom(0), null, null, null, tileFrom(1)]
      }),
      [water, tables],
      ctx
    )

    const visuals = drawnVisuals(renderer)
    const sprite = visuals.findIndex((visual) => visual.sprite)
    const coveringTable = visuals.findIndex((visual) => !visual.sprite && visual.x === 32)

    expect(visuals).toHaveLength(3)
    expect(sprite).toBeGreaterThanOrEqual(0)
    expect(sprite).toBeLessThan(coveringTable)
  })

  it('redraws a tile that grows over a tile drawn above its mesh', () => {
    // Both S tilesets share one atlas, so the edit keeps the batch group and
    // could be written in place, below the T tile it now covers.
    const atlas = makeTexture(32, 128)
    const smallS = new TileSetRenderer(makeResolvedTileset({ tileheight: 32 }), null)
    smallS.setTileTexture(0, new Texture({ source: atlas.source }))
    const tallS = new TileSetRenderer(makeResolvedTileset({ tileheight: 96 }), null)
    tallS.setTileTexture(0, new Texture({ source: atlas.source }))
    const other = makeTileset(32)
    const renderer = new TileLayerRenderer(
      makeResolvedTileLayer({
        width: 2,
        height: 3,
        tiles: [tileFrom(1), tileFrom(2), null, null, null, tileFrom(0)]
      }),
      [smallS, tallS, other],
      ctx
    )

    renderer.setTile(1, 2, tileFrom(1))

    const visuals = drawnVisuals(renderer)
    const covered = visuals.findIndex((visual) => visual.source === other.getTexture(0)!.source)
    const grown = visuals.findIndex(
      (visual) => visual.source === atlas.source && visual.x === 32 && visual.y === 0
    )
    expect(covered).toBeGreaterThanOrEqual(0)
    expect(covered).toBeLessThan(grown)
  })

  it('orders overlapping raw rectangles by insertion', () => {
    const first = makeTexture(8, 8)
    const second = makeTexture(8, 8)
    const renderer = new PackedTileLayerRenderer()

    renderer.addTextureRect({ texture: first, x: 0, y: 0, width: 16, height: 16 })
    renderer.addTextureRect({ texture: second, x: 8, y: 8, width: 16, height: 16 })
    renderer.addTextureRect({ texture: first, x: 16, y: 16, width: 16, height: 16 })
    renderer.finalize()

    expect(drawnVisuals(renderer).map((visual) => [visual.source, visual.x])).toEqual([
      [first.source, 0],
      [second.source, 8],
      [first.source, 16]
    ])
  })
})
