/**
 * @vitest-environment jsdom
 */

import { readFileSync } from 'node:fs'
import {
  AnimatedSprite,
  Assets,
  BufferImageSource,
  DOMAdapter,
  extensions,
  Mesh,
  Sprite,
  Texture
} from 'pixi.js'
import { describe, expect, it, vi } from 'vitest'
import {
  type FetchFn,
  fetchMapDependencies,
  loadTextureManifest,
  loadTiledMapAsset,
  rebaseTilesetImages,
  resolveAssetUrl,
  tiledMapLoader
} from '../../src/renderer/tiledAssetLoader.js'
import type { TiledMap as TiledMapData, TiledTileset } from '../../src/types/index.js'

const MINIMAL_TILESET: TiledTileset = {
  firstgid: 1,
  name: 'tiles',
  tilewidth: 16,
  tileheight: 16,
  columns: 4,
  tilecount: 16,
  margin: 0,
  spacing: 0
}

const MINIMAL_TSX = `<?xml version="1.0" encoding="UTF-8"?>
<tileset name="tiles" tilewidth="16" tileheight="16" tilecount="16" columns="4">
  <image source="tiles.png" width="64" height="64"/>
</tileset>`

const MINIMAL_TX = `<?xml version="1.0" encoding="UTF-8"?>
<template>
  <object name="enemy" type="mob" width="16" height="16"/>
</template>`

const MINIMAL_TMX = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" tiledversion="1.11.0" orientation="orthogonal" renderorder="right-down" width="1" height="1" tilewidth="16" tileheight="16" infinite="0" nextlayerid="2" nextobjectid="1">
  <tileset firstgid="1" name="tiles" tilewidth="16" tileheight="16" tilecount="1" columns="1">
    <image source="tiles.png" width="16" height="16"/>
  </tileset>
  <layer id="1" name="ground" width="1" height="1">
    <data encoding="csv">1</data>
  </layer>
</map>`

function makeMap(overrides: Partial<TiledMapData> = {}): TiledMapData {
  return {
    type: 'map',
    version: '1.10',
    orientation: 'orthogonal',
    width: 10,
    height: 10,
    tilewidth: 16,
    tileheight: 16,
    infinite: false,
    nextlayerid: 2,
    nextobjectid: 1,
    layers: [],
    tilesets: [],
    ...overrides
  }
}

type FakeResponse = {
  ok: boolean
  status: number
  statusText: string
  text(): Promise<string>
  json(): Promise<unknown>
}

function makeFetcher(responses: Record<string, FakeResponse>) {
  return vi.fn<FetchFn>((resource) => {
    const url = String(resource)
    const entry = responses[url]
    if (!entry) return Promise.reject(new Error(`Unexpected fetch: ${url}`))
    return Promise.resolve(entry as Response)
  })
}

function jsonResponse(data: unknown): FakeResponse {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    text: () => Promise.resolve(''),
    json: () => Promise.resolve(data)
  }
}

function textResponse(content: string): FakeResponse {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    text: () => Promise.resolve(content),
    json: () => Promise.resolve({})
  }
}

function errorResponse(status: number, statusText: string): FakeResponse {
  return {
    ok: false,
    status,
    statusText,
    text: () => Promise.resolve(''),
    json: () => Promise.resolve({})
  }
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

describe('fetchMapDependencies', () => {
  describe('external tilesets', () => {
    it('returns empty map when no external tilesets', async () => {
      const map = makeMap({ tilesets: [{ ...MINIMAL_TILESET }] })
      const fetcher = makeFetcher({})
      const { externalTilesets } = await fetchMapDependencies(map, 'maps', fetcher)
      expect(externalTilesets.size).toBe(0)
      expect(fetcher).not.toHaveBeenCalled()
    })

    it('fetches and parses a .tsj external tileset as JSON', async () => {
      const map = makeMap({ tilesets: [{ firstgid: 1, source: 'tiles.tsj' }] })
      const fetcher = makeFetcher({ 'maps/tiles.tsj': jsonResponse(MINIMAL_TILESET) })
      const { externalTilesets } = await fetchMapDependencies(map, 'maps', fetcher)
      expect(externalTilesets.get('tiles.tsj')?.name).toBe('tiles')
      expect(fetcher).toHaveBeenCalledWith('maps/tiles.tsj')
    })

    it('fetches and parses a .tsx external tileset as XML', async () => {
      const map = makeMap({ tilesets: [{ firstgid: 1, source: 'tiles.tsx' }] })
      const fetcher = makeFetcher({ 'maps/tiles.tsx': textResponse(MINIMAL_TSX) })
      const { externalTilesets } = await fetchMapDependencies(map, 'maps', fetcher)
      expect(externalTilesets.get('tiles.tsx')?.name).toBe('tiles')
      expect(externalTilesets.get('tiles.tsx')?.columns).toBe(4)
    })

    it('constructs URL from basePath and source', async () => {
      const map = makeMap({ tilesets: [{ firstgid: 1, source: 'tilesets/world.tsj' }] })
      const fetcher = makeFetcher({
        'assets/maps/tilesets/world.tsj': jsonResponse(MINIMAL_TILESET)
      })
      await fetchMapDependencies(map, 'assets/maps', fetcher)
      expect(fetcher).toHaveBeenCalledWith('assets/maps/tilesets/world.tsj')
    })

    it('rebases nested TSJ atlas and image-collection paths without mutating the response', async () => {
      const map = makeMap({ tilesets: [{ firstgid: 1, source: 'tilesets/world.tsj' }] })
      const source = {
        ...MINIMAL_TILESET,
        image: '../images/ground.png',
        tiles: [{ id: 0, image: '../objects/coin.png', imagewidth: 16, imageheight: 16 }]
      }
      const fetcher = makeFetcher({
        'maps/tilesets/world.tsj': jsonResponse(source)
      })

      const { externalTilesets } = await fetchMapDependencies(map, 'maps', fetcher)
      const resolved = externalTilesets.get('tilesets/world.tsj')

      expect(resolved?.image).toBe('images/ground.png')
      expect(resolved?.tiles?.[0]?.image).toBe('objects/coin.png')
      expect(source.image).toBe('../images/ground.png')
      expect(source.tiles[0]?.image).toBe('../objects/coin.png')
    })

    it('rebases nested TSX atlas paths', async () => {
      const map = makeMap({ tilesets: [{ firstgid: 1, source: 'tilesets/world.tsx' }] })
      const fetcher = makeFetcher({
        'maps/tilesets/world.tsx': textResponse(
          MINIMAL_TSX.replace('tiles.png', '../images/tiles.png')
        )
      })

      const { externalTilesets } = await fetchMapDependencies(map, 'maps', fetcher)

      expect(externalTilesets.get('tilesets/world.tsx')?.image).toBe('images/tiles.png')
    })
  })

  describe('templates', () => {
    it('returns empty map when no template references', async () => {
      const map = makeMap({
        layers: [
          {
            type: 'objectgroup',
            id: 1,
            name: 'objs',
            opacity: 1,
            visible: true,
            x: 0,
            y: 0,
            objects: [
              {
                id: 1,
                name: 'rock',
                type: '',
                x: 0,
                y: 0,
                width: 16,
                height: 16,
                rotation: 0,
                visible: true
              }
            ]
          }
        ]
      })
      const fetcher = makeFetcher({})
      const { templates } = await fetchMapDependencies(map, 'maps', fetcher)
      expect(templates.size).toBe(0)
    })

    it('fetches and parses a .tj template as JSON', async () => {
      const tplData = {
        type: 'template',
        object: {
          id: 0,
          name: 'enemy',
          type: '',
          x: 0,
          y: 0,
          width: 16,
          height: 16,
          rotation: 0,
          visible: true
        }
      }
      const map = makeMap({
        layers: [
          {
            type: 'objectgroup',
            id: 1,
            name: 'objs',
            opacity: 1,
            visible: true,
            x: 0,
            y: 0,
            objects: [
              {
                id: 1,
                name: '',
                type: '',
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                rotation: 0,
                visible: true,
                template: 'enemy.tj'
              }
            ]
          }
        ]
      })
      const fetcher = makeFetcher({ 'maps/enemy.tj': jsonResponse(tplData) })
      const { templates } = await fetchMapDependencies(map, 'maps', fetcher)
      expect(templates.get('enemy.tj')?.object.name).toBe('enemy')
    })

    it('fetches and parses a .tx template as XML', async () => {
      const map = makeMap({
        layers: [
          {
            type: 'objectgroup',
            id: 1,
            name: 'objs',
            opacity: 1,
            visible: true,
            x: 0,
            y: 0,
            objects: [
              {
                id: 1,
                name: '',
                type: '',
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                rotation: 0,
                visible: true,
                template: 'enemy.tx'
              }
            ]
          }
        ]
      })
      const fetcher = makeFetcher({ 'maps/enemy.tx': textResponse(MINIMAL_TX) })
      const { templates } = await fetchMapDependencies(map, 'maps', fetcher)
      expect(templates.get('enemy.tx')?.object.name).toBe('enemy')
    })

    it('rebases an external tileset source relative to the template directory', async () => {
      const template = {
        type: 'template' as const,
        tileset: { firstgid: 1, source: '../tilesets/world.tsj' },
        object: {
          id: 0,
          name: 'enemy',
          type: '',
          x: 0,
          y: 0,
          width: 16,
          height: 16,
          rotation: 0,
          visible: true,
          gid: 2
        }
      }
      const map = makeMap({
        layers: [
          {
            type: 'objectgroup',
            id: 1,
            name: 'objects',
            opacity: 1,
            visible: true,
            x: 0,
            y: 0,
            objects: [
              {
                id: 1,
                name: '',
                type: '',
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                rotation: 0,
                visible: true,
                template: 'templates/enemy.tj'
              }
            ]
          }
        ]
      })
      const fetcher = makeFetcher({
        'maps/templates/enemy.tj': jsonResponse(template)
      })

      const { templates } = await fetchMapDependencies(map, 'maps', fetcher)

      expect(templates.get('templates/enemy.tj')?.tileset).toEqual({
        firstgid: 1,
        source: 'tilesets/world.tsj'
      })
      expect(template.tileset.source).toBe('../tilesets/world.tsj')
    })

    it('discovers template references inside nested group layers', async () => {
      const tplData = {
        type: 'template',
        object: {
          id: 0,
          name: 'boss',
          type: '',
          x: 0,
          y: 0,
          width: 16,
          height: 16,
          rotation: 0,
          visible: true
        }
      }
      const map = makeMap({
        layers: [
          {
            type: 'group',
            id: 1,
            name: 'outer',
            opacity: 1,
            visible: true,
            x: 0,
            y: 0,
            layers: [
              {
                type: 'group',
                id: 2,
                name: 'inner',
                opacity: 1,
                visible: true,
                x: 0,
                y: 0,
                layers: [
                  {
                    type: 'objectgroup',
                    id: 3,
                    name: 'objs',
                    opacity: 1,
                    visible: true,
                    x: 0,
                    y: 0,
                    objects: [
                      {
                        id: 1,
                        name: '',
                        type: '',
                        x: 0,
                        y: 0,
                        width: 0,
                        height: 0,
                        rotation: 0,
                        visible: true,
                        template: 'boss.tj'
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      })
      const fetcher = makeFetcher({ 'maps/boss.tj': jsonResponse(tplData) })
      const { templates } = await fetchMapDependencies(map, 'maps', fetcher)
      expect(templates.has('boss.tj')).toBe(true)
      expect(fetcher).toHaveBeenCalledWith('maps/boss.tj')
    })

    it('fetches each unique template source only once', async () => {
      const tplData = {
        type: 'template',
        object: {
          id: 0,
          name: 'enemy',
          type: '',
          x: 0,
          y: 0,
          width: 16,
          height: 16,
          rotation: 0,
          visible: true
        }
      }
      const obj = {
        id: 0,
        name: '',
        type: '',
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        rotation: 0,
        visible: true,
        template: 'enemy.tj'
      }
      const map = makeMap({
        layers: [
          {
            type: 'objectgroup',
            id: 1,
            name: 'objs',
            opacity: 1,
            visible: true,
            x: 0,
            y: 0,
            objects: [
              { ...obj, id: 1 },
              { ...obj, id: 2 },
              { ...obj, id: 3 }
            ]
          }
        ]
      })
      const fetcher = makeFetcher({ 'maps/enemy.tj': jsonResponse(tplData) })
      await fetchMapDependencies(map, 'maps', fetcher)
      expect(fetcher).toHaveBeenCalledTimes(1)
    })
  })
})

describe('Tiled asset path resolution', () => {
  it('normalizes relative paths and preserves absolute asset sources', () => {
    expect(resolveAssetUrl('maps/tilesets', '../images/tiles.png')).toBe('maps/images/tiles.png')
    expect(resolveAssetUrl('maps', 'https://cdn.example.com/tiles.png')).toBe(
      'https://cdn.example.com/tiles.png'
    )
    expect(resolveAssetUrl('maps', '/assets/tiles.png')).toBe('/assets/tiles.png')
    expect(resolveAssetUrl('maps', 'data:image/png;base64,abc')).toBe('data:image/png;base64,abc')
  })

  it('returns a rebased clone and leaves pathless tile definitions reusable', () => {
    const pathlessTile = { id: 1, type: 'solid' }
    const tileset = {
      ...MINIMAL_TILESET,
      image: '../atlas.png',
      tiles: [{ id: 0, image: '../coin.png', imagewidth: 16, imageheight: 16 }, pathlessTile]
    }

    const rebased = rebaseTilesetImages(tileset, 'tilesets')

    expect(rebased).not.toBe(tileset)
    expect(rebased.image).toBe('atlas.png')
    expect(rebased.tiles?.[0]?.image).toBe('coin.png')
    expect(rebased.tiles?.[1]).toBe(pathlessTile)
    expect(tileset.image).toBe('../atlas.png')
  })

  it('keeps parent directory segments that escape a relative base', () => {
    expect(resolveAssetUrl('assets/maps', '../tilesets/terrain.tsx')).toBe(
      'assets/tilesets/terrain.tsx'
    )
    expect(resolveAssetUrl('maps', '../../shared/x.png')).toBe('../shared/x.png')
    expect(resolveAssetUrl('', '../tilesets/tiles.png')).toBe('../tilesets/tiles.png')
    expect(resolveAssetUrl('.', './a/../b.png')).toBe('b.png')
    expect(resolveAssetUrl('https://cdn.test/game/maps', '../tiles.png')).toBe(
      'https://cdn.test/game/tiles.png'
    )
    expect(resolveAssetUrl('/game/maps', '../tiles.png')).toBe('/game/tiles.png')
  })

  it('rebases tileset images onto a tileset outside the map directory', () => {
    const tileset = { ...MINIMAL_TILESET, image: 'tiles.png' }

    expect(rebaseTilesetImages(tileset, '../tilesets').image).toBe('../tilesets/tiles.png')
  })
})

describe('loadTextureManifest', () => {
  it('calls the default Pixi asset loader with Assets as this', async () => {
    const loadSpy = vi.spyOn(Assets, 'load').mockImplementation(function (
      this: typeof Assets
    ): Promise<Texture> {
      expect(this).toBe(Assets)
      return Promise.resolve(Texture.EMPTY)
    })

    try {
      const textures = await loadTextureManifest({
        tilesetImages: [{ source: 'tiles.png', url: 'maps/tiles.png' }],
        tileImages: [],
        imageLayerImages: []
      })

      expect(textures.tilesetTextures.get('tiles.png')).toBe(Texture.EMPTY)
      expect(loadSpy).toHaveBeenCalledWith('maps/tiles.png')
    } finally {
      loadSpy.mockRestore()
    }
  })

  it('routes GIF tile images with URL suffixes into texture and gif source maps', async () => {
    const gifSource = { textures: [Texture.EMPTY] }
    const loadAsset = vi.fn(() => Promise.resolve(gifSource))

    const textures = await loadTextureManifest(
      {
        tilesetImages: [],
        tileImages: [{ source: 'coin.gif', url: 'maps/coin.gif?v=2' }],
        imageLayerImages: []
      },
      loadAsset
    )

    expect(textures.tileImageTextures.get('coin.gif')).toBe(Texture.EMPTY)
    expect(textures.tileImageGifSources.get('coin.gif')).toBe(gifSource)
  })

  it('routes GIF image layers with URL fragments into texture and gif source maps', async () => {
    const gifSource = { textures: [Texture.EMPTY] }
    const loadAsset = vi.fn(() => Promise.resolve(gifSource))

    const textures = await loadTextureManifest(
      {
        tilesetImages: [],
        tileImages: [],
        imageLayerImages: [{ source: 'waterfall.gif', url: 'maps/waterfall.gif#loop' }]
      },
      loadAsset
    )

    expect(textures.imageLayerTextures.get('waterfall.gif')).toBe(Texture.EMPTY)
    expect(textures.imageLayerGifSources.get('waterfall.gif')).toBe(gifSource)
  })

  it('extracts the first GIF texture from a tileset atlas URL with a query', async () => {
    const gifSource = { textures: [Texture.EMPTY] }

    const textures = await loadTextureManifest(
      {
        tilesetImages: [{ source: 'tiles.gif', url: 'maps/tiles.gif?cache=1' }],
        tileImages: [],
        imageLayerImages: []
      },
      () => Promise.resolve(gifSource)
    )

    expect(textures.tilesetTextures.get('tiles.gif')).toBe(Texture.EMPTY)
  })
})

describe('loadTiledMapAsset', () => {
  it('defaults to Pixi DOMAdapter fetch when no fetchFn is provided', async () => {
    const map = makeMap({ width: 1, height: 1 })
    const previousAdapter = DOMAdapter.get()
    const adapterFetch = vi.fn((url: RequestInfo | URL) => {
      expect(url).toBe('maps/level.tmj')
      return Promise.resolve(jsonResponse(map) as Response)
    })

    DOMAdapter.set({ ...previousAdapter, fetch: adapterFetch })

    try {
      const asset = await loadTiledMapAsset('maps/level.tmj')

      expect(asset.mapData.width).toBe(1)
      expect(adapterFetch).toHaveBeenCalledWith('maps/level.tmj')
    } finally {
      DOMAdapter.set(previousAdapter)
    }
  })

  it('loads a TMJ map through the full asset pipeline', async () => {
    const map = makeMap({
      width: 1,
      height: 1,
      tilesets: [{ ...MINIMAL_TILESET, image: 'tiles.png', imagewidth: 16, imageheight: 16 }],
      layers: [
        {
          type: 'tilelayer',
          id: 1,
          name: 'ground',
          opacity: 1,
          visible: true,
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          data: [1]
        }
      ]
    })
    const fetcher = makeFetcher({ 'maps/level.tmj': jsonResponse(map) })
    const loadAsset = vi.fn(() => Promise.resolve(Texture.EMPTY))

    const asset = await loadTiledMapAsset('maps/level.tmj', { fetchFn: fetcher, loadAsset })

    expect(asset.mapData.layers[0]?.name).toBe('ground')
    expect(asset.container.label).toBe('TiledMap')
    expect(loadAsset).toHaveBeenCalledWith('maps/tiles.png')
  })

  it('reports the URL and status when the map request fails', async () => {
    const fetcher = makeFetcher({
      'maps/missing.tmj': errorResponse(404, 'Not Found')
    })

    await expect(loadTiledMapAsset('maps/missing.tmj', { fetchFn: fetcher })).rejects.toThrow(
      'Failed to fetch Tiled asset "maps/missing.tmj": 404 Not Found'
    )
  })

  it('reports the URL and status when a dependency request fails', async () => {
    const map = makeMap({ tilesets: [{ firstgid: 1, source: 'broken.tsj' }] })
    const fetcher = makeFetcher({
      'maps/level.tmj': jsonResponse(map),
      'maps/broken.tsj': errorResponse(500, 'Server Error')
    })

    await expect(loadTiledMapAsset('maps/level.tmj', { fetchFn: fetcher })).rejects.toThrow(
      'Failed to fetch Tiled asset "maps/broken.tsj": 500 Server Error'
    )
  })

  it('loads a TMX map through the full asset pipeline', async () => {
    const fetcher = makeFetcher({ 'maps/level.tmx': textResponse(MINIMAL_TMX) })
    const loadAsset = vi.fn(() => Promise.resolve(Texture.EMPTY))

    const asset = await loadTiledMapAsset('maps/level.tmx', { fetchFn: fetcher, loadAsset })

    expect(asset.mapData.tilesets[0]?.name).toBe('tiles')
    expect(asset.mapData.layers[0]?.name).toBe('ground')
    expect(loadAsset).toHaveBeenCalledWith('maps/tiles.png')
  })

  it('loads the MagicLand TMX fixture with its GIF tileset atlas as packed meshes', async () => {
    const mapUrl = 'test/fixtures/magicland/MagicLand.tmx'
    const tilesetUrl = 'test/fixtures/magicland/magiclanddizzy_tiles.gif'
    const tmx = readFileSync(mapUrl, 'utf8')
    const gifBytes = readFileSync(tilesetUrl)
    const fetcher = makeFetcher({ [mapUrl]: textResponse(tmx) })
    const atlasTexture = makeTexture(790, 430)
    const gifSource = { textures: [atlasTexture] }
    const loadAsset = vi.fn(() => Promise.resolve(gifSource))

    const asset = await loadTiledMapAsset(mapUrl, { fetchFn: fetcher, loadAsset })
    const background = asset.container.getLayer('background')

    expect(gifBytes.byteLength).toBeGreaterThan(0)
    expect(asset.mapData.width).toBe(460)
    expect(asset.mapData.height).toBe(75)
    expect(asset.mapData.tilesets[0]?.image).toBe('magiclanddizzy_tiles.gif')
    expect(loadAsset).toHaveBeenCalledWith(tilesetUrl)
    expect(background?.children.length).toBeGreaterThan(1)
    expect(background?.children.every((child) => child instanceof Mesh)).toBe(true)
    for (const child of background?.children ?? []) {
      const mesh = child as Mesh
      expect(mesh.geometry.batchMode).toBe('batch')
      expect(mesh.geometry.positions.length).toBeLessThanOrEqual(16_000 * 8)
    }
  })

  it('rejects when an external tileset dependency is missing', async () => {
    const map = makeMap({ tilesets: [{ firstgid: 1, source: 'missing.tsj' }] })
    const fetcher = makeFetcher({ 'maps/level.tmj': jsonResponse(map) })

    await expect(loadTiledMapAsset('maps/level.tmj', { fetchFn: fetcher })).rejects.toThrow(
      'Unexpected fetch: maps/missing.tsj'
    )
  })

  it('loads external TSJ tilesets through the full asset pipeline', async () => {
    const map = makeMap({
      width: 1,
      height: 1,
      tilesets: [{ firstgid: 1, source: 'tiles.tsj' }],
      layers: [
        {
          type: 'tilelayer',
          id: 1,
          name: 'ground',
          opacity: 1,
          visible: true,
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          data: [1]
        }
      ]
    })
    const fetcher = makeFetcher({
      'maps/level.tmj': jsonResponse(map),
      'maps/tiles.tsj': jsonResponse({
        ...MINIMAL_TILESET,
        image: 'tiles.png',
        imagewidth: 64,
        imageheight: 64
      })
    })
    const loadAsset = vi.fn(() => Promise.resolve(Texture.EMPTY))

    const asset = await loadTiledMapAsset('maps/level.tmj', { fetchFn: fetcher, loadAsset })

    expect(asset.mapData.tilesets[0]?.source).toBe('tiles.tsj')
    expect(asset.mapData.tilesets[0]?.name).toBe('tiles')
    expect(loadAsset).toHaveBeenCalledWith('maps/tiles.png')
  })

  it('loads nested external TSX tilesets through the full asset pipeline', async () => {
    const map = makeMap({
      width: 1,
      height: 1,
      tilesets: [{ firstgid: 1, source: 'tilesets/world.tsx' }],
      layers: [
        {
          type: 'tilelayer',
          id: 1,
          name: 'ground',
          opacity: 1,
          visible: true,
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          data: [1]
        }
      ]
    })
    const fetcher = makeFetcher({
      'maps/level.tmj': jsonResponse(map),
      'maps/tilesets/world.tsx': textResponse(
        MINIMAL_TSX.replace('tiles.png', '../images/tiles.png')
      )
    })
    const loadAsset = vi.fn(() => Promise.resolve(Texture.EMPTY))

    const asset = await loadTiledMapAsset('maps/level.tmj', { fetchFn: fetcher, loadAsset })

    expect(asset.mapData.tilesets[0]?.source).toBe('tilesets/world.tsx')
    expect(asset.mapData.tilesets[0]?.name).toBe('tiles')
    expect(asset.mapData.tilesets[0]?.image).toBe('images/tiles.png')
    expect(loadAsset).toHaveBeenCalledWith('maps/images/tiles.png')
  })

  it('loads nested external tileset images relative to their TSJ directory', async () => {
    const map = makeMap({
      width: 1,
      height: 1,
      tilesets: [{ firstgid: 1, source: 'tilesets/world.tsj' }],
      layers: [
        {
          type: 'tilelayer',
          id: 1,
          name: 'ground',
          opacity: 1,
          visible: true,
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          data: [1]
        }
      ]
    })
    const fetcher = makeFetcher({
      'maps/level.tmj': jsonResponse(map),
      'maps/tilesets/world.tsj': jsonResponse({
        ...MINIMAL_TILESET,
        image: '../images/tiles.png',
        imagewidth: 64,
        imageheight: 64,
        tiles: [{ id: 0, image: '../objects/coin.png', imagewidth: 16, imageheight: 16 }]
      })
    })
    const loadAsset = vi.fn(() => Promise.resolve(Texture.EMPTY))

    const asset = await loadTiledMapAsset('maps/level.tmj', { fetchFn: fetcher, loadAsset })

    expect(asset.mapData.tilesets[0]?.image).toBe('images/tiles.png')
    expect(asset.mapData.tilesets[0]?.tiles.get(0)?.image).toBe('objects/coin.png')
    expect(loadAsset).toHaveBeenCalledWith('maps/images/tiles.png')
    expect(loadAsset).toHaveBeenCalledWith('maps/objects/coin.png')
  })

  it('remaps a template tile GID when map and template use different relative paths', async () => {
    const map = makeMap({
      tilesets: [{ firstgid: 100, source: 'tilesets/world.tsj' }],
      layers: [
        {
          type: 'objectgroup',
          id: 1,
          name: 'objects',
          opacity: 1,
          visible: true,
          x: 0,
          y: 0,
          objects: [
            {
              id: 1,
              name: '',
              type: '',
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              rotation: 0,
              visible: true,
              template: 'templates/enemy.tj'
            }
          ]
        }
      ]
    })
    const fetcher = makeFetcher({
      'maps/level.tmj': jsonResponse(map),
      'maps/tilesets/world.tsj': jsonResponse(MINIMAL_TILESET),
      'maps/templates/enemy.tj': jsonResponse({
        type: 'template',
        tileset: { firstgid: 1, source: '../tilesets/world.tsj' },
        object: {
          id: 0,
          name: 'enemy',
          type: '',
          x: 0,
          y: 0,
          width: 16,
          height: 16,
          rotation: 0,
          visible: true,
          gid: 3
        }
      })
    })

    const asset = await loadTiledMapAsset('maps/level.tmj', { fetchFn: fetcher })
    const objectLayer = asset.mapData.layers[0]

    expect(objectLayer?.type).toBe('objectgroup')
    if (objectLayer?.type !== 'objectgroup') throw new Error('Expected object layer')
    expect(objectLayer.objects[0]?.tile).toMatchObject({ gid: 102, localId: 2, tilesetIndex: 0 })
  })

  it('forwards non-texture map options to the constructed TiledMap', async () => {
    const map = makeMap({
      width: 2,
      height: 1,
      tilesets: [
        {
          ...MINIMAL_TILESET,
          columns: 2,
          tilecount: 2,
          image: 'tiles.png',
          imagewidth: 32,
          imageheight: 16
        }
      ],
      layers: [
        {
          type: 'tilelayer',
          id: 1,
          name: 'ground',
          opacity: 1,
          visible: true,
          x: 0,
          y: 0,
          width: 2,
          height: 1,
          data: [1, 2]
        },
        {
          type: 'tilelayer',
          id: 2,
          name: 'filtered-out',
          opacity: 1,
          visible: true,
          x: 0,
          y: 0,
          width: 2,
          height: 1,
          data: [1, 2]
        }
      ]
    })
    const fetcher = makeFetcher({ 'maps/level.tmj': jsonResponse(map) })
    const loadAsset = vi.fn(() => Promise.resolve(makeTexture(32, 16)))

    const asset = await loadTiledMapAsset('maps/level.tmj', {
      fetchFn: fetcher,
      loadAsset,
      mapOptions: {
        layerFilter: (layer) => layer.name === 'ground',
        tileSpritePadding: 0.5,
        tileMeshBatchSize: 1
      }
    })
    const ground = asset.container.getLayer('ground')!

    expect(asset.container.getLayer('filtered-out')).toBeUndefined()
    expect(ground.children).toHaveLength(2)
    expect(Array.from((ground.children[0] as Mesh).geometry.positions)).toContain(16.5)
  })

  it('forwards map options supplied through Pixi Assets metadata', async () => {
    const map = makeMap({
      layers: [
        {
          type: 'objectgroup',
          id: 1,
          name: 'kept',
          opacity: 1,
          visible: true,
          x: 0,
          y: 0,
          objects: []
        },
        {
          type: 'objectgroup',
          id: 2,
          name: 'filtered-out',
          opacity: 1,
          visible: true,
          x: 0,
          y: 0,
          objects: []
        }
      ]
    })
    const previousAdapter = DOMAdapter.get()
    const adapterFetch = vi.fn(() => Promise.resolve(jsonResponse(map) as Response))
    DOMAdapter.set({ ...previousAdapter, fetch: adapterFetch })

    try {
      const asset = await tiledMapLoader.load?.('maps/level.tmj', {
        src: 'maps/level.tmj',
        data: { mapOptions: { layerFilter: (layer) => layer.name === 'kept' } }
      })

      expect(asset?.container.getLayer('kept')).toBeDefined()
      expect(asset?.container.getLayer('filtered-out')).toBeUndefined()
    } finally {
      DOMAdapter.set(previousAdapter)
    }
  })

  it('fetches duplicate object templates once through the full asset pipeline', async () => {
    const templateObject = {
      id: 0,
      name: 'enemy',
      type: '',
      x: 0,
      y: 0,
      width: 16,
      height: 16,
      rotation: 0,
      visible: true
    }
    const map = makeMap({
      layers: [
        {
          type: 'objectgroup',
          id: 1,
          name: 'objects',
          opacity: 1,
          visible: true,
          x: 0,
          y: 0,
          objects: [
            { ...templateObject, id: 1, name: '', width: 0, height: 0, template: 'enemy.tj' },
            { ...templateObject, id: 2, name: '', width: 0, height: 0, template: 'enemy.tj' }
          ]
        }
      ]
    })
    const fetcher = makeFetcher({
      'maps/level.tmj': jsonResponse(map),
      'maps/enemy.tj': jsonResponse({ type: 'template', object: templateObject })
    })

    const asset = await loadTiledMapAsset('maps/level.tmj', { fetchFn: fetcher })

    expect(asset.mapData.layers[0]?.type).toBe('objectgroup')
    expect(fetcher).toHaveBeenCalledWith('maps/enemy.tj')
    expect(fetcher.mock.calls.filter(([url]) => url === 'maps/enemy.tj')).toHaveLength(1)
  })
})

describe('cached map assets', () => {
  const map = makeMap({
    width: 1,
    height: 1,
    tilesets: [{ ...MINIMAL_TILESET, image: 'tiles.png', imagewidth: 16, imageheight: 16 }],
    layers: [
      {
        type: 'tilelayer',
        id: 1,
        name: 'ground',
        opacity: 1,
        visible: true,
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        data: [1]
      }
    ]
  })

  function loadOptions() {
    return {
      fetchFn: makeFetcher({ 'maps/cached.tmj': jsonResponse(map) }),
      loadAsset: <T>() => Promise.resolve(makeTexture(16, 16) as T)
    }
  }

  it('keeps the same container while it is alive', async () => {
    const asset = await loadTiledMapAsset('maps/cached.tmj', loadOptions())

    expect(asset.container).toBe(asset.container)
  })

  it('rebuilds the container once the previous one was destroyed', async () => {
    const asset = await loadTiledMapAsset('maps/cached.tmj', loadOptions())
    const first = asset.container
    first.getLayer('ground')?.addChild(new Sprite(Texture.WHITE))

    first.destroy({ children: true })
    const second = asset.container

    expect(second).not.toBe(first)
    expect(second.destroyed).toBe(false)
    expect(second.getLayer('ground')).toBeDefined()
    expect(second.getTile('ground', 0, 0)?.gid).toBe(1)
  })

  it('serves a usable container from the Assets cache after destroy (issue #34)', async () => {
    extensions.add(tiledMapLoader)
    await Assets.init({ skipDetections: true })
    // The Assets resolver hands the loader an absolute URL.
    const fetchFn = vi.fn<FetchFn>(() => Promise.resolve(jsonResponse(map) as Response))
    const data = { ...loadOptions(), fetchFn }
    const src = { alias: 'issue-34-map', src: 'maps/cached.tmj', data }

    try {
      const first = await Assets.load(src)
      first.container.getLayer('ground')?.addChild(new Sprite(Texture.WHITE))
      first.container.destroy({ children: true })

      const second = await Assets.load(src)

      expect(second).toBe(first)
      expect(fetchFn).toHaveBeenCalledOnce()
      expect(second.container.getLayer('ground')).toBeDefined()
    } finally {
      await Assets.unload(src)
      extensions.remove(tiledMapLoader)
    }
  })

  it('destroys the current container on unload without rebuilding a destroyed one', async () => {
    const asset = await loadTiledMapAsset('maps/cached.tmj', loadOptions())
    const container = asset.container

    await tiledMapLoader.unload?.(asset)

    expect(container.destroyed).toBe(true)

    await tiledMapLoader.unload?.(asset)
    expect(asset.container).not.toBe(container)
  })
})

describe('maps referencing a sibling directory', () => {
  const terrain = { ...MINIMAL_TILESET, name: 'terrain', image: 'terrain.png' }
  const other = { ...MINIMAL_TILESET, name: 'other', image: 'other.png' }
  const map = makeMap({
    width: 1,
    height: 1,
    tilesets: [
      { firstgid: 1, source: 'other.tsj' },
      { firstgid: 17, source: '../tilesets/terrain.tsj' }
    ],
    layers: [
      {
        type: 'objectgroup',
        id: 1,
        name: 'objects',
        opacity: 1,
        visible: true,
        x: 0,
        y: 0,
        objects: [
          {
            id: 1,
            name: '',
            type: '',
            x: 0,
            y: 16,
            width: 0,
            height: 0,
            rotation: 0,
            visible: true,
            template: 'tree.tj'
          }
        ]
      }
    ]
  })
  const template = {
    type: 'template',
    tileset: { firstgid: 1, source: '../tilesets/terrain.tsj' },
    object: {
      id: 0,
      name: 'tree',
      type: '',
      x: 0,
      y: 0,
      width: 16,
      height: 16,
      rotation: 0,
      visible: true,
      gid: 2
    }
  }

  async function load() {
    const loadAsset = vi.fn(<T>() => Promise.resolve(makeTexture(64, 64) as T))
    const asset = await loadTiledMapAsset('assets/maps/level.tmj', {
      fetchFn: makeFetcher({
        'assets/maps/level.tmj': jsonResponse(map),
        'assets/maps/other.tsj': jsonResponse(other),
        'assets/tilesets/terrain.tsj': jsonResponse(terrain),
        'assets/maps/tree.tj': jsonResponse(template)
      }),
      loadAsset
    })
    return { asset, loadAsset }
  }

  it('loads tileset images relative to the tileset file', async () => {
    const { loadAsset } = await load()

    expect(loadAsset).toHaveBeenCalledWith('assets/tilesets/terrain.png')
    expect(loadAsset).toHaveBeenCalledWith('assets/maps/other.png')
  })

  it('remaps template gids into the matching map tileset', async () => {
    const { asset } = await load()
    const layer = asset.mapData.layers[0]

    expect(layer?.type).toBe('objectgroup')
    const tile = layer?.type === 'objectgroup' ? layer.objects[0]?.tile : undefined
    expect(tile).toMatchObject({ gid: 18, tilesetIndex: 1, localId: 1 })
  })
})

describe('unloading a map asset', () => {
  it('stops and destroys animated tile sprites', async () => {
    const tileset = {
      ...MINIMAL_TILESET,
      image: 'tiles.png',
      tiles: [
        {
          id: 0,
          animation: [
            { tileid: 0, duration: 100 },
            { tileid: 1, duration: 100 }
          ]
        }
      ]
    }
    const map = makeMap({
      width: 1,
      height: 1,
      tilesets: [tileset],
      layers: [
        {
          type: 'tilelayer',
          id: 1,
          name: 'ground',
          opacity: 1,
          visible: true,
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          data: [1]
        }
      ]
    })
    const asset = await loadTiledMapAsset('maps/animated.tmj', {
      fetchFn: makeFetcher({ 'maps/animated.tmj': jsonResponse(map) }),
      loadAsset: <T>() => Promise.resolve(makeTexture(64, 64) as T)
    })
    const sprite = asset.container.getLayer('ground')?.children[0] as AnimatedSprite

    expect(sprite).toBeInstanceOf(AnimatedSprite)
    await tiledMapLoader.unload?.(asset)

    expect(sprite.destroyed).toBe(true)
    expect(sprite.playing).toBe(false)
  })
})

describe('map responses without a success flag', () => {
  it('parses responses from adapters that report no ok flag or status 0', async () => {
    const map = makeMap({ width: 3, height: 2 })
    const noFlag = { ...jsonResponse(map), ok: undefined as unknown as boolean }
    const fileResponse = { ...jsonResponse(map), ok: false, status: 0, statusText: '' }

    for (const response of [noFlag, fileResponse]) {
      const asset = await loadTiledMapAsset('maps/local.tmj', {
        fetchFn: makeFetcher({ 'maps/local.tmj': response })
      })
      expect(asset.mapData.width).toBe(3)
    }
  })
})
