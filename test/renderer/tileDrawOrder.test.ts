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

  it.each([
    ['isometric', { ...ctx, orientation: 'isometric', tilewidth: 64 }],
    [
      'staggered',
      { ...ctx, orientation: 'staggered', tilewidth: 64, staggeraxis: 'y', staggerindex: 'odd' }
    ],
    [
      'hexagonal',
      {
        ...ctx,
        orientation: 'hexagonal',
        tilewidth: 64,
        hexsidelength: 16,
        staggeraxis: 'y',
        staggerindex: 'odd'
      }
    ]
  ] satisfies [string, MapContext][])(
    'keeps one mesh per tileset for grid-sized %s tiles',
    (_name, mapCtx) => {
      const tiles: ResolvedTile[] = []
      for (let index = 0; index < 64; index++) {
        tiles.push(tileFrom(((index % 8) + Math.floor(index / 8)) % 2))
      }
      const tileset = (): TileSetRenderer => {
        const renderer = new TileSetRenderer(
          makeResolvedTileset({ tilewidth: mapCtx.tilewidth, tileheight: 32 }),
          null
        )
        renderer.setTileTexture(0, makeTexture(mapCtx.tilewidth, 32))
        return renderer
      }
      const renderer = new TileLayerRenderer(
        makeResolvedTileLayer({ width: 8, height: 8, tiles }),
        [tileset(), tileset()],
        mapCtx
      )

      expect(renderer.children).toHaveLength(2)
    }
  )

  it('keeps a visible seam overhang in render order', () => {
    const left = makeTileset(32)
    const middle = makeTileset(32)
    const renderer = new TileLayerRenderer(
      makeResolvedTileLayer({
        width: 3,
        height: 1,
        tiles: [tileFrom(0), tileFrom(1), tileFrom(0)]
      }),
      [left, middle],
      { ...ctx, tileSpritePadding: 4 }
    )

    const order = drawnVisuals(renderer).map((visual) => visual.x)
    expect(order).toEqual([0, 32, 64])
  })

  it('draws a tile over a turned hexagonal tile before it', () => {
    const hexCtx: MapContext = {
      ...ctx,
      orientation: 'hexagonal',
      hexsidelength: 16,
      staggeraxis: 'x',
      staggerindex: 'odd'
    }
    const renderer = new TileLayerRenderer(
      makeResolvedTileLayer({
        width: 3,
        height: 1,
        tiles: [tileFrom(0), makeResolvedTile({ tilesetIndex: 1, diagonalFlip: true }), tileFrom(0)]
      }),
      [makeTileset(32), makeTileset(32)],
      hexCtx
    )

    const visuals = drawnVisuals(renderer)
    expect(visuals.map((visual) => visual.sprite)).toEqual([false, true, false])
  })

  it('draws a tile over a squashed hexagonal tile turned into its cell', () => {
    // A 48x24 hexagon turned by 60 degrees reaches well into the cell below.
    const hexCtx: MapContext = {
      ...ctx,
      orientation: 'hexagonal',
      tilewidth: 48,
      tileheight: 24,
      hexsidelength: 16,
      staggeraxis: 'x',
      staggerindex: 'odd'
    }
    const tileset = (): TileSetRenderer => {
      const renderer = new TileSetRenderer(
        makeResolvedTileset({ tilewidth: 48, tileheight: 24 }),
        null
      )
      renderer.setTileTexture(0, makeTexture(48, 24))
      return renderer
    }
    const renderer = new TileLayerRenderer(
      makeResolvedTileLayer({
        width: 1,
        height: 3,
        tiles: [tileFrom(0), makeResolvedTile({ tilesetIndex: 1, diagonalFlip: true }), tileFrom(0)]
      }),
      [tileset(), tileset()],
      hexCtx
    )

    expect(drawnVisuals(renderer).map((visual) => visual.sprite)).toEqual([false, true, false])
  })

  it('keeps one mesh per tileset beside an oversized tile at default padding', () => {
    // The tall tile makes the layer unconfined, so every tile consults the grid.
    const tiles: ResolvedTile[] = [tileFrom(2)]
    for (let index = 1; index < 16; index++) {
      tiles.push(tileFrom(((index % 4) + Math.floor(index / 4)) % 2))
    }
    const renderer = new TileLayerRenderer(
      makeResolvedTileLayer({ width: 4, height: 4, tiles }),
      [makeTileset(32), makeTileset(32), makeTileset(96)],
      { ...ctx, tileSpritePadding: 0.01 }
    )

    expect(renderer.children).toHaveLength(3)
  })

  it('draws an oversized isometric tile over a grid-sized tile it covers', () => {
    const isoCtx: MapContext = { ...ctx, orientation: 'isometric', tilewidth: 64 }
    const ground = new TileSetRenderer(makeResolvedTileset({ tilewidth: 64, tileheight: 32 }), null)
    ground.setTileTexture(0, makeTexture(64, 32))
    const trees = new TileSetRenderer(makeResolvedTileset({ tilewidth: 64, tileheight: 96 }), null)
    trees.setTileTexture(0, makeTexture(64, 96))
    // Cell (0, 0) holds ground, cell (1, 1) a tree reaching up over it, and
    // cell (1, 0) more ground, so the tree cannot join the first mesh.
    const renderer = new TileLayerRenderer(
      makeResolvedTileLayer({
        width: 2,
        height: 2,
        tiles: [tileFrom(0), tileFrom(1), tileFrom(0), tileFrom(1)]
      }),
      [ground, trees],
      isoCtx
    )

    const sources = drawnVisuals(renderer).map((visual) => visual.source)
    const treeSource = trees.getTexture(0)!.source
    const groundSource = ground.getTexture(0)!.source
    expect(sources.lastIndexOf(groundSource)).toBeLessThan(sources.lastIndexOf(treeSource))
  })

  it('opens batches split only for draw order with a small capacity', () => {
    const first = makeTexture(8, 8)
    const second = makeTexture(8, 8)
    const renderer = new PackedTileLayerRenderer(1000)

    for (let index = 0; index < 4; index++) {
      renderer.addTextureRect({
        texture: index % 2 === 0 ? first : second,
        x: index * 8,
        y: 0,
        width: 16,
        height: 16
      })
    }

    const batches = (renderer as unknown as { _drawItems: { tileCapacity: number }[] })._drawItems
    expect(batches.map((batch) => batch.tileCapacity)).toEqual([1000, 1000, 16, 16])
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
