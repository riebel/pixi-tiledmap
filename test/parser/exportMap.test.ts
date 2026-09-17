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
import type {
  ParseOptions,
  ResolvedMap,
  ResolvedObjectLayer,
  TiledMap,
  TiledObject,
  TiledTileset,
  TiledTilesetFile
} from '../../src/types/index.js'

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
                color: '#ff00ff00',
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

  it('keeps a stored id counter above the highest id in use', () => {
    const map = parseMap(baseMap({ nextlayerid: 50, nextobjectid: 70 }))
    expect(map).toMatchObject({ nextlayerid: 50, nextobjectid: 70 })
    expect(expectRoundTrip(map)).toMatchObject({ nextlayerid: 50, nextobjectid: 70 })
  })

  it('carries class, lock, blend mode, skew and tileset metadata through and back', () => {
    const raw = baseMap({
      class: 'Level',
      compressionlevel: 5,
      orientation: 'oblique',
      skewx: 4,
      skewy: -2,
      tilesets: [
        {
          ...gridTileset,
          class: 'Terrain',
          backgroundcolor: '#102030',
          transparentcolor: '#ff00ff'
        }
      ],
      layers: [
        {
          id: 1,
          name: 'ground',
          class: 'Floor',
          locked: true,
          mode: 'multiply',
          type: 'tilelayer',
          x: 0,
          y: 0,
          opacity: 1,
          visible: true,
          width: 2,
          height: 2,
          data: [3, 0, 0, 3]
        },
        {
          id: 2,
          name: 'things',
          type: 'objectgroup',
          x: 0,
          y: 0,
          opacity: 1,
          visible: true,
          objects: [
            {
              id: 1,
              name: 'pill',
              type: 'Pickup',
              x: 1,
              y: 2,
              width: 8,
              height: 4,
              rotation: 0,
              visible: true,
              opacity: 0.5,
              capsule: true
            }
          ]
        }
      ]
    })

    const map = parseMap(raw)
    expect(map).toMatchObject({ class: 'Level', compressionlevel: 5, skewx: 4, skewy: -2 })
    expect(map.tilesets[0]).toMatchObject({
      class: 'Terrain',
      backgroundcolor: '#102030',
      transparentcolor: '#ff00ff'
    })
    expect(map.layers[0]).toMatchObject({ class: 'Floor', locked: true, mode: 'multiply' })
    expect((map.layers[1] as ResolvedObjectLayer).objects[0]).toMatchObject({
      opacity: 0.5,
      capsule: true
    })

    const exported = expectRoundTrip(map)
    expect(exported).toMatchObject({ class: 'Level', compressionlevel: 5, skewx: 4, skewy: -2 })
    expect(exported.tilesets[0]).toMatchObject({ class: 'Terrain', transparentcolor: '#ff00ff' })
    expect(exported.layers[0]).toMatchObject({ class: 'Floor', locked: true, mode: 'multiply' })
    expect(exported.layers[1]!.objects![0]).toMatchObject({ opacity: 0.5, capsule: true })
  })

  it('reads Tiled 1.9 JSON classes and a numeric format version', () => {
    const map = parseMap(
      baseMap({
        version: 1.9 as unknown as string,
        tilesets: [{ ...gridTileset, tiles: [{ id: 0, class: 'Wall' }] }],
        layers: [
          {
            id: 1,
            name: 'things',
            type: 'objectgroup',
            x: 0,
            y: 0,
            opacity: 1,
            visible: true,
            objects: [{ id: 1, name: '', class: 'Door', x: 0, y: 0 } as unknown as TiledObject]
          }
        ]
      })
    )

    expect(map.version).toBe('1.9')
    expect(map.tilesets[0]!.tiles.get(0)).toEqual({ id: 0, type: 'Wall' })
    expect((map.layers[0] as ResolvedObjectLayer).objects[0]!.type).toBe('Door')
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

/**
 * The shape a real `.tsj` on disk has: `type: 'tileset'` and no `firstgid`,
 * which belongs to the map that references it. This literal needing a cast to
 * compile would itself be the bug.
 */
const groundTilesetFile: TiledTilesetFile = {
  type: 'tileset',
  version: '1.10',
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

describe('externalTilesets', () => {
  it('accepts a tileset file that has no firstgid', () => {
    const map = parseMap(baseMap({ tilesets: [{ firstgid: 3, source: 'ground.tsj' }] }), {
      externalTilesets: new Map([['ground.tsj', groundTilesetFile]])
    })

    // The reference supplies the first global id, not the file.
    expect(map.tilesets[0]).toMatchObject({ name: 'ground', firstgid: 3, source: 'ground.tsj' })
  })

  it('still accepts an embedded tileset, which carries a firstgid', () => {
    const map = parseMap(baseMap({ tilesets: [{ firstgid: 9, source: 'ground.tsj' }] }), {
      externalTilesets: new Map([['ground.tsj', gridTileset]])
    })

    // The file's own firstgid of 3 is ignored in favour of the reference's.
    expect(map.tilesets[0]).toMatchObject({ name: 'ground', firstgid: 9 })
  })
})

describe('exportTileset standalone', () => {
  it('writes a tileset file with no firstgid', () => {
    const map = parseMap(baseMap())
    const file = exportTileset(map.tilesets[1]!, { standalone: true, tiledversion: '1.11.2' })

    expect(file).not.toHaveProperty('firstgid')
    expect(file).toMatchObject({
      type: 'tileset',
      version: '1.10',
      tiledversion: '1.11.2',
      name: 'ground'
    })
  })

  it('omits tiledversion when not given', () => {
    const map = parseMap(baseMap())
    expect(exportTileset(map.tilesets[1]!, { standalone: true })).not.toHaveProperty('tiledversion')
  })

  it('still writes the embedded form by default', () => {
    const map = parseMap(baseMap())
    const embedded = exportTileset(map.tilesets[1]!)

    expect(embedded.firstgid).toBe(3)
    expect(embedded).not.toHaveProperty('type')
  })

  it('round-trips a tileset back through externalTilesets', () => {
    const map = parseMap(baseMap())
    const file = exportTileset(map.tilesets[1]!, { standalone: true })

    const viaFile = parseMap(
      baseMap({ tilesets: [objectTileset, { firstgid: 3, source: 'g.tsj' }] }),
      {
        externalTilesets: new Map([['g.tsj', file]])
      }
    )

    // Identical to the embedded tileset apart from the path it now came from
    // and the format version a standalone file carries.
    expect(viaFile.tilesets[1]).toEqual({ ...map.tilesets[1]!, source: 'g.tsj', version: '1.10' })
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
