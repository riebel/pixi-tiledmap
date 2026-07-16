/**
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { exportMap, exportTileset } from '../../src/parser/exportMap.js'
import { parseTmx } from '../../src/parser/parseTmx.js'
import { parseMap, parseMapAsync } from '../../src/parser/resolveMap.js'
import type { ParseOptions, ResolvedMap, TiledMap, TiledTileset } from '../../src/types/index.js'

const fixtureDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'magicland')

/**
 * The property that matters: exporting a resolved map and parsing it back must
 * land on exactly the same map. Anything the exporter drops or mis-defaults
 * shows up here as a diff rather than as a silently wrong file.
 */
function expectRoundTrip(map: ResolvedMap, options?: ParseOptions): TiledMap {
  const exported = exportMap(map)
  expect(parseMap(exported, options)).toEqual(map)
  return exported
}

const objectTileset: TiledTileset = {
  firstgid: 1,
  name: 'objects',
  tilewidth: 16,
  tileheight: 16,
  columns: 0,
  tilecount: 2,
  margin: 0,
  spacing: 0,
  tiles: [
    { id: 0, image: 'start.png', imagewidth: 48, imageheight: 48 },
    { id: 1, image: 'goal.png', imagewidth: 16, imageheight: 176 }
  ]
}

const gridTileset: TiledTileset = {
  firstgid: 3,
  name: 'ground',
  tilewidth: 16,
  tileheight: 16,
  columns: 4,
  tilecount: 8,
  margin: 0,
  spacing: 0,
  image: 'ground.png',
  imagewidth: 64,
  imageheight: 32
}

function baseMap(overrides?: Partial<TiledMap>): TiledMap {
  return {
    type: 'map',
    version: '1.10',
    orientation: 'orthogonal',
    renderorder: 'right-down',
    width: 2,
    height: 2,
    tilewidth: 16,
    tileheight: 16,
    infinite: false,
    nextlayerid: 2,
    nextobjectid: 1,
    tilesets: [objectTileset, gridTileset],
    layers: [],
    ...overrides
  }
}

describe('exportMap', () => {
  it('round-trips a tile layer, preserving empty cells', () => {
    const map = parseMap(
      baseMap({
        layers: [
          {
            id: 1,
            name: 'ground',
            type: 'tilelayer',
            x: 0,
            y: 0,
            width: 2,
            height: 2,
            opacity: 1,
            visible: true,
            data: [3, 0, 0, 4]
          }
        ]
      })
    )

    const exported = expectRoundTrip(map)
    expect(exported.layers[0]!.data).toEqual([3, 0, 0, 4])
  })

  it('round-trips every flip flag on a tile', () => {
    const raw = baseMap({
      layers: [
        {
          id: 1,
          name: 'flipped',
          type: 'tilelayer',
          x: 0,
          y: 0,
          width: 2,
          height: 2,
          opacity: 1,
          visible: true,
          // Bare, h-flip, h+v+d flip, hex-120 rotation.
          data: [3, 0x80000004, 0xe0000003, 0x10000004]
        }
      ]
    })

    const map = parseMap(raw)
    const exported = expectRoundTrip(map)
    expect(exported.layers[0]!.data).toEqual(raw.layers[0]!.data)
  })

  it('round-trips all four layer types nested in groups', () => {
    const map = parseMap(
      baseMap({
        nextlayerid: 6,
        layers: [
          {
            id: 1,
            name: 'outer',
            type: 'group',
            x: 0,
            y: 0,
            opacity: 0.5,
            visible: true,
            offsetx: 8,
            offsety: -4,
            parallaxx: 0.5,
            parallaxy: 0.25,
            tintcolor: '#ff00ff',
            properties: [{ name: 'depth', type: 'int', value: 3 }],
            layers: [
              {
                id: 2,
                name: 'inner-tiles',
                type: 'tilelayer',
                x: 0,
                y: 0,
                width: 2,
                height: 2,
                opacity: 1,
                visible: false,
                data: [3, 4, 5, 6]
              },
              {
                id: 3,
                name: 'inner-image',
                type: 'imagelayer',
                x: 0,
                y: 0,
                opacity: 1,
                visible: true,
                image: 'bg.png',
                imagewidth: 64,
                imageheight: 32,
                repeatx: true,
                transparentcolor: '#00ff00'
              },
              {
                id: 4,
                name: 'inner-objects',
                type: 'objectgroup',
                x: 0,
                y: 0,
                opacity: 1,
                visible: true,
                draworder: 'index',
                objects: [
                  {
                    id: 7,
                    name: 'koopa',
                    type: 'enemy',
                    x: 16,
                    y: 32,
                    width: 16,
                    height: 32,
                    rotation: 90,
                    visible: true,
                    gid: 2,
                    properties: [{ name: 'winged', type: 'bool', value: true }]
                  },
                  {
                    id: 8,
                    name: 'zone',
                    type: '',
                    x: 0,
                    y: 0,
                    width: 32,
                    height: 32,
                    rotation: 0,
                    visible: true,
                    ellipse: true
                  },
                  {
                    id: 9,
                    name: 'path',
                    type: '',
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    rotation: 0,
                    visible: true,
                    polyline: [
                      { x: 0, y: 0 },
                      { x: 16, y: 16 }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      })
    )

    expectRoundTrip(map)
  })

  it('round-trips an infinite map without dropping chunks', () => {
    const map = parseMap(
      baseMap({
        infinite: true,
        layers: [
          {
            id: 1,
            name: 'chunked',
            type: 'tilelayer',
            x: 0,
            y: 0,
            width: 4,
            height: 4,
            opacity: 1,
            visible: true,
            chunks: [
              { x: 0, y: 0, width: 2, height: 2, data: [3, 4, 5, 6] },
              { x: 16, y: -16, width: 2, height: 2, data: [0, 0, 7, 8] }
            ]
          }
        ]
      })
    )

    const exported = expectRoundTrip(map)
    expect(exported.layers[0]!.chunks).toHaveLength(2)
    expect(exported.layers[0]!.chunks![1]).toMatchObject({ x: 16, y: -16, data: [0, 0, 7, 8] })
  })

  it('round-trips an infinite layer that has no chunks yet', () => {
    const map = parseMap(
      baseMap({
        infinite: true,
        layers: [
          {
            id: 1,
            name: 'empty',
            type: 'tilelayer',
            x: 0,
            y: 0,
            width: 4,
            height: 4,
            opacity: 1,
            visible: true,
            chunks: []
          }
        ]
      })
    )

    // An empty layer of an infinite map is still infinite, so it must not come
    // back as a finite layer.
    expect(map.layers[0]).toMatchObject({ infinite: true, chunks: [] })
    expectRoundTrip(map)
  })

  it('round-trips an image-collection tileset', () => {
    const map = parseMap(baseMap())
    const exported = expectRoundTrip(map)

    const tileset = exported.tilesets[0] as TiledTileset
    expect(tileset.columns).toBe(0)
    expect(tileset.tiles).toEqual(objectTileset.tiles)
  })

  it('writes external tilesets back as references', () => {
    const externalTilesets = new Map([['ground.tsj', gridTileset]])
    const raw = baseMap({ tilesets: [{ firstgid: 3, source: 'ground.tsj' }] })
    const map = parseMap(raw, { externalTilesets })

    const exported = expectRoundTrip(map, { externalTilesets })
    expect(exported.tilesets).toEqual([{ firstgid: 3, source: 'ground.tsj' }])
  })

  it('externalises embedded tilesets named in tilesetSources', () => {
    const map = parseMap(baseMap())
    const exported = exportMap(map, { tilesetSources: { ground: 'tilesets/ground.tsj' } })

    expect(exported.tilesets[1]).toEqual({ firstgid: 3, source: 'tilesets/ground.tsj' })
    // Unnamed tilesets stay embedded.
    expect(exported.tilesets[0]).toMatchObject({ name: 'objects' })
  })

  it('allocates nextlayerid and nextobjectid across nested groups', () => {
    const map = parseMap(
      baseMap({
        layers: [
          {
            id: 4,
            name: 'group',
            type: 'group',
            x: 0,
            y: 0,
            opacity: 1,
            visible: true,
            layers: [
              {
                id: 9,
                name: 'objects',
                type: 'objectgroup',
                x: 0,
                y: 0,
                opacity: 1,
                visible: true,
                objects: [
                  {
                    id: 41,
                    name: '',
                    type: '',
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    rotation: 0,
                    visible: true,
                    point: true
                  }
                ]
              }
            ]
          }
        ]
      })
    )

    const exported = exportMap(map)
    expect(exported.nextlayerid).toBe(10)
    expect(exported.nextobjectid).toBe(42)
  })

  it('omits fields the parser would default anyway', () => {
    const exported = exportMap(parseMap(baseMap()))

    expect(exported).not.toHaveProperty('properties')
    expect(exported).not.toHaveProperty('parallaxoriginx')
    expect(exported.tilesets[1]).not.toHaveProperty('tileoffset')
    expect(exported.tilesets[1]).not.toHaveProperty('fillmode')
  })

  it('writes base64 tile data the parser reads back', () => {
    const map = parseMap(
      baseMap({
        layers: [
          {
            id: 1,
            name: 'ground',
            type: 'tilelayer',
            x: 0,
            y: 0,
            width: 2,
            height: 2,
            opacity: 1,
            visible: true,
            data: [3, 0, 0x80000004, 4]
          }
        ]
      })
    )

    const exported = exportMap(map, { encoding: 'base64' })
    expect(exported.layers[0]!.encoding).toBe('base64')
    expect(typeof exported.layers[0]!.data).toBe('string')
    expect(parseMap(exported)).toEqual(map)
  })
})

describe('exportTileset', () => {
  it('omits source, which belongs to the reference rather than the tileset', () => {
    const map = parseMap(baseMap({ tilesets: [{ firstgid: 3, source: 'ground.tsj' }] }), {
      externalTilesets: new Map([['ground.tsj', gridTileset]])
    })

    const exported = exportTileset(map.tilesets[0]!)
    expect(exported).not.toHaveProperty('source')
    expect(exported).toMatchObject({ name: 'ground', firstgid: 3, image: 'ground.png' })
  })
})

describe('exportMap on the MagicLand fixture', () => {
  it('round-trips a real TMX map', async () => {
    const tmx = readFileSync(join(fixtureDir, 'MagicLand.tmx'), 'utf-8')
    const map = await parseMapAsync(parseTmx(tmx))

    // The fixture's layer data is gzipped, so it only parses through the async
    // entry point; the export is plain CSV and parses either way.
    expect(await parseMapAsync(exportMap(map))).toEqual(map)
    expect(parseMap(exportMap(map))).toEqual(map)
  })
})
