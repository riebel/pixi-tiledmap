/**
 * @vitest-environment jsdom
 */

import { readFileSync } from 'node:fs'
import { Assets, BufferImageSource, DOMAdapter, Mesh, Texture } from 'pixi.js'
import { describe, expect, it, vi } from 'vitest'
import {
  fetchMapDependencies,
  loadTextureManifest,
  loadTiledMapAsset
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

type FakeResponse = { text(): Promise<string>; json(): Promise<unknown> }

function makeFetcher(responses: Record<string, FakeResponse>) {
  return vi.fn((url: string): Promise<FakeResponse> => {
    const entry = responses[url]
    if (!entry) return Promise.reject(new Error(`Unexpected fetch: ${url}`))
    return Promise.resolve(entry)
  })
}

function jsonResponse(data: unknown): FakeResponse {
  return { text: () => Promise.resolve(''), json: () => Promise.resolve(data) }
}

function textResponse(content: string): FakeResponse {
  return { text: () => Promise.resolve(content), json: () => Promise.resolve({}) }
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

  it('routes GIF tile images into texture and gif source maps', async () => {
    const gifSource = { textures: [Texture.EMPTY] }
    const loadAsset = vi.fn(() => Promise.resolve(gifSource))

    const textures = await loadTextureManifest(
      {
        tilesetImages: [],
        tileImages: [{ source: 'coin.gif', url: 'maps/coin.gif' }],
        imageLayerImages: []
      },
      loadAsset
    )

    expect(textures.tileImageTextures.get('coin.gif')).toBe(Texture.EMPTY)
    expect(textures.tileImageGifSources.get('coin.gif')).toBe(gifSource)
  })

  it('routes GIF image layers into texture and gif source maps', async () => {
    const gifSource = { textures: [Texture.EMPTY] }
    const loadAsset = vi.fn(() => Promise.resolve(gifSource))

    const textures = await loadTextureManifest(
      {
        tilesetImages: [],
        tileImages: [],
        imageLayerImages: [{ source: 'waterfall.gif', url: 'maps/waterfall.gif' }]
      },
      loadAsset
    )

    expect(textures.imageLayerTextures.get('waterfall.gif')).toBe(Texture.EMPTY)
    expect(textures.imageLayerGifSources.get('waterfall.gif')).toBe(gifSource)
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

  it('loads external TSX tilesets through the full asset pipeline', async () => {
    const map = makeMap({
      width: 1,
      height: 1,
      tilesets: [{ firstgid: 1, source: 'tiles.tsx' }],
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
      'maps/tiles.tsx': textResponse(MINIMAL_TSX)
    })
    const loadAsset = vi.fn(() => Promise.resolve(Texture.EMPTY))

    const asset = await loadTiledMapAsset('maps/level.tmj', { fetchFn: fetcher, loadAsset })

    expect(asset.mapData.tilesets[0]?.source).toBe('tiles.tsx')
    expect(asset.mapData.tilesets[0]?.name).toBe('tiles')
    expect(loadAsset).toHaveBeenCalledWith('maps/tiles.png')
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
