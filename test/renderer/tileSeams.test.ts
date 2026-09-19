/**
 * @vitest-environment jsdom
 */
import { AnimatedSprite, BufferImageSource, Mesh, Rectangle, Texture } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { TileLayerRenderer } from '../../src/renderer/TileLayerRenderer.js'
import { TileSetRenderer } from '../../src/renderer/TileSetRenderer.js'
import type { MapContext, ResolvedTile, TiledTileDefinition } from '../../src/types/index.js'
import {
  makeResolvedTile,
  makeResolvedTileLayer,
  makeResolvedTileset
} from '../helpers/resolved.js'

const TILE_SIZE = 32

function makeAtlasTileset(tiles = new Map<number, TiledTileDefinition>()): TileSetRenderer {
  const source = new BufferImageSource({
    resource: new Uint8Array(64 * TILE_SIZE * 4),
    width: 64,
    height: TILE_SIZE
  })
  return new TileSetRenderer(
    makeResolvedTileset({
      tilewidth: TILE_SIZE,
      tileheight: TILE_SIZE,
      columns: 2,
      tilecount: 2,
      tiles
    }),
    new Texture({ source, frame: new Rectangle(0, 0, 64, TILE_SIZE) })
  )
}

function firstMesh(renderer: TileLayerRenderer): Mesh {
  const mesh = renderer.children.find((child) => child instanceof Mesh)
  if (!mesh) throw new Error('Expected a packed tile mesh')
  return mesh
}

describe('subpixel tile seam protection', () => {
  it('keeps packed UV endpoints inside their atlas frame at the Woodland device transform', () => {
    const tileCount = 15
    const ctx: MapContext = {
      orientation: 'orthogonal',
      renderorder: 'right-down',
      tilewidth: TILE_SIZE,
      tileheight: TILE_SIZE,
      tileSpritePadding: 0.01
    }
    const renderer = new TileLayerRenderer(
      makeResolvedTileLayer({
        width: tileCount,
        height: 1,
        tiles: Array.from({ length: tileCount }, () => makeResolvedTile())
      }),
      [makeAtlasTileset()],
      ctx
    )

    // Woodland's camera places this tile boundary exactly on a device-pixel
    // centre. Small GPU interpolation errors can therefore reach either side
    // of the atlas frame even though geometry overlap covers the boundary.
    const dpr = 1.25
    const cameraX = -430
    const localBoundary = 14 * TILE_SIZE
    expect((localBoundary + cameraX) * dpr).toBe(22.5)

    const tileBeforeBoundary = 13
    const offset = tileBeforeBoundary * 8
    const geometry = firstMesh(renderer).geometry
    const right = geometry.positions[offset + 2]!
    expect((right + cameraX) * dpr).toBeGreaterThan(22.5)

    // The same overlap remains positive across supported integer and
    // fractional DPRs, and under a fractional parent scale.
    for (const [resolution, scale] of [
      [1, 1],
      [1.25, 1],
      [1.5, 0.875],
      [2, 1.125]
    ]) {
      const transformedBoundary = (localBoundary * scale + cameraX) * resolution
      const transformedRight = (right * scale + cameraX) * resolution
      expect(transformedRight).toBeGreaterThan(transformedBoundary)
    }

    // NEAREST filters the complete atlas, not an individual Texture frame.
    // Every endpoint must remain within texels 0..31 even if the rasterizer
    // evaluates the endpoint itself; u=0.5 would select neighbouring texel 32.
    const rightUvs = [geometry.uvs[offset + 2]!, geometry.uvs[offset + 4]!]
    expect(rightUvs.map((u) => Math.floor(u * 64))).toEqual([31, 31])
  })

  it('keeps every flip permutation inside the protected atlas frame', () => {
    const flips: Partial<ResolvedTile>[] = [
      {},
      { horizontalFlip: true },
      { verticalFlip: true },
      { horizontalFlip: true, verticalFlip: true },
      { diagonalFlip: true },
      { diagonalFlip: true, horizontalFlip: true },
      { diagonalFlip: true, verticalFlip: true },
      { diagonalFlip: true, horizontalFlip: true, verticalFlip: true }
    ]
    const ctx: MapContext = {
      orientation: 'orthogonal',
      renderorder: 'right-down',
      tilewidth: TILE_SIZE,
      tileheight: TILE_SIZE,
      tileSpritePadding: 0.01
    }
    const renderer = new TileLayerRenderer(
      makeResolvedTileLayer({
        width: flips.length,
        height: 1,
        tiles: flips.map((flags) => makeResolvedTile(flags))
      }),
      [makeAtlasTileset()],
      ctx
    )

    const uvs = Array.from(firstMesh(renderer).geometry.uvs)
    for (let offset = 0; offset < uvs.length; offset += 8) {
      const tileUvs = uvs.slice(offset, offset + 8)
      const us = tileUvs.filter((_, index) => index % 2 === 0)
      const vs = tileUvs.filter((_, index) => index % 2 === 1)
      expect(Math.min(...us)).toBeCloseTo(0.5 / 64)
      expect(Math.max(...us)).toBeCloseTo(31.5 / 64)
      expect(Math.min(...vs)).toBeCloseTo(0.5 / TILE_SIZE)
      expect(Math.max(...vs)).toBeCloseTo(31.5 / TILE_SIZE)
    }
  })

  it('protects animated frames while preserving sprite size and flip placement', () => {
    const tiles = new Map<number, TiledTileDefinition>([
      [
        0,
        {
          id: 0,
          animation: [
            { tileid: 0, duration: 100 },
            { tileid: 1, duration: 120 }
          ]
        }
      ]
    ])
    const ctx: MapContext = {
      orientation: 'orthogonal',
      renderorder: 'right-down',
      tilewidth: TILE_SIZE,
      tileheight: TILE_SIZE,
      tileSpritePadding: 0.01
    }
    const renderer = new TileLayerRenderer(
      makeResolvedTileLayer({
        width: 1,
        height: 1,
        tiles: [makeResolvedTile({ horizontalFlip: true })]
      }),
      [makeAtlasTileset(tiles)],
      ctx
    )

    const sprite = renderer.children[0] as AnimatedSprite
    expect(sprite).toBeInstanceOf(AnimatedSprite)
    expect(sprite.width).toBeCloseTo(TILE_SIZE + 0.01)
    expect(sprite.getBounds()).toMatchObject({ x: 0, y: 0 })
    expect(sprite.textures.map((texture) => texture.frame.x)).toEqual([0.5, 32.5])
    expect(sprite.textures.map((texture) => texture.frame.width)).toEqual([31, 31])
    expect(sprite.textures.map((texture) => texture.orig.width)).toEqual([32, 32])
  })

  it('protects neighbouring tiles across tilesets and one-tile mesh batches', () => {
    const ctx: MapContext = {
      orientation: 'orthogonal',
      renderorder: 'right-down',
      tilewidth: TILE_SIZE,
      tileheight: TILE_SIZE,
      tileSpritePadding: 0.01,
      tileMeshBatchSize: 1
    }
    const renderer = new TileLayerRenderer(
      makeResolvedTileLayer({
        width: 4,
        height: 1,
        tiles: [0, 1, 0, 1].map((tilesetIndex) => makeResolvedTile({ tilesetIndex }))
      }),
      [makeAtlasTileset(), makeAtlasTileset()],
      ctx
    )
    const meshes = renderer.children.filter((child) => child instanceof Mesh)

    expect(meshes).toHaveLength(4)
    for (const mesh of meshes) {
      const us = Array.from(mesh.geometry.uvs).filter((_, index) => index % 2 === 0)
      expect(Math.min(...us)).toBeCloseTo(0.5 / 64)
      expect(Math.max(...us)).toBeCloseTo(31.5 / 64)
    }
  })

  it.each([
    ['disabled overlap', { orientation: 'orthogonal', tileSpritePadding: 0 }],
    [
      'oversized orthogonal tiles',
      { orientation: 'orthogonal', tileheight: 16, tileSpritePadding: 0.01 }
    ],
    ['isometric maps', { orientation: 'isometric', tileSpritePadding: 0.01 }],
    [
      'staggered maps',
      {
        orientation: 'staggered',
        staggeraxis: 'y',
        staggerindex: 'odd',
        tileSpritePadding: 0.01
      }
    ],
    [
      'hexagonal maps',
      {
        orientation: 'hexagonal',
        staggeraxis: 'y',
        staggerindex: 'odd',
        hexsidelength: 16,
        tileSpritePadding: 0.01
      }
    ],
    ['oblique maps', { orientation: 'oblique', skewx: 0.5, skewy: 0, tileSpritePadding: 0.01 }]
  ])('leaves UVs unchanged for %s', (_label, overrides) => {
    const ctx: MapContext = {
      orientation: 'orthogonal',
      renderorder: 'right-down',
      tilewidth: TILE_SIZE,
      tileheight: TILE_SIZE,
      ...overrides
    } as MapContext
    const renderer = new TileLayerRenderer(
      makeResolvedTileLayer({ width: 1, height: 1, tiles: [makeResolvedTile()] }),
      [makeAtlasTileset()],
      ctx
    )

    expect(Array.from(firstMesh(renderer).geometry.uvs)).toEqual([0, 0, 0.5, 0, 0.5, 1, 0, 1])
  })
})
