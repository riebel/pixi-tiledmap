import {
  Assets,
  DOMAdapter,
  ExtensionType,
  extensions,
  type LoaderParser,
  path as pixiPath,
  type Texture
} from 'pixi.js'
import type { GifSource } from 'pixi.js/gif'
import { GifAsset } from 'pixi.js/gif'
import { parseMapAsync, parseTmx, parseTsx, parseTx } from '../parser'
import { isTilesetRef } from '../parser/tilesetHelpers.js'
import type {
  ResolvedMap,
  TiledLayer,
  TiledMapAsset,
  TiledMap as TiledMapData,
  TiledObject,
  TiledObjectTemplate,
  TiledTileset
} from '../types'
import { TiledMap } from './TiledMap.js'

extensions.add(GifAsset)

export type FetchFn = (
  url: string
) => Promise<{ text(): Promise<string>; json(): Promise<unknown> }>
export type LoadAssetFn = <T>(url: string) => Promise<T>

export interface TiledAssetPipelineOptions {
  fetchFn?: FetchFn
  loadAsset?: LoadAssetFn
}

interface TextureManifestEntry {
  source: string
  url: string
}

interface TextureManifest {
  tilesetImages: TextureManifestEntry[]
  tileImages: TextureManifestEntry[]
  imageLayerImages: TextureManifestEntry[]
}

interface LoadedTextureSets {
  tilesetTextures: Map<string, Texture>
  imageLayerTextures: Map<string, Texture>
  tileImageTextures: Map<string, Texture>
  tileImageGifSources: Map<string, GifSource>
  imageLayerGifSources: Map<string, GifSource>
}

export async function fetchMapDependencies(
  data: TiledMapData,
  basePath: string,
  fetchFn: FetchFn = defaultFetch
): Promise<{
  externalTilesets: Map<string, TiledTileset>
  templates: Map<string, TiledObjectTemplate>
}> {
  const externalTilesets = new Map<string, TiledTileset>()
  for (const ts of data.tilesets) {
    if (!isTilesetRef(ts)) continue
    const tsUrl = pixiPath.join(basePath, ts.source)
    const tsResponse = await fetchFn(tsUrl)
    const tsExt = pixiPath.extname(ts.source).toLowerCase()
    externalTilesets.set(
      ts.source,
      tsExt === '.tsx'
        ? parseTsx(await tsResponse.text())
        : ((await tsResponse.json()) as TiledTileset)
    )
  }

  const templates = new Map<string, TiledObjectTemplate>()
  const templateSources = new Set<string>()
  for (const obj of walkObjects(data.layers)) {
    if (obj.template) templateSources.add(obj.template)
  }
  await Promise.all(
    Array.from(templateSources).map(async (src) => {
      const tplUrl = pixiPath.join(basePath, src)
      const tplResponse = await fetchFn(tplUrl)
      const tplExt = pixiPath.extname(src).toLowerCase()
      templates.set(
        src,
        tplExt === '.tx'
          ? parseTx(await tplResponse.text())
          : ((await tplResponse.json()) as TiledObjectTemplate)
      )
    })
  )

  return { externalTilesets, templates }
}

export const tiledMapLoader: LoaderParser<TiledMapAsset> = {
  extension: {
    type: ExtensionType.LoadParser,
    name: 'tiledmap-loader'
  },

  id: 'tiledmap-loader',
  name: 'tiledmap-loader',

  test(url: string): boolean {
    const ext = pixiPath.extname(url).toLowerCase()
    return ext === '.tmx' || ext === '.tmj'
  },

  async load(url: string): Promise<TiledMapAsset> {
    return loadTiledMapAsset(url)
  }
}

export async function loadTiledMapAsset(
  url: string,
  options?: TiledAssetPipelineOptions
): Promise<TiledMapAsset> {
  const fetchFn = options?.fetchFn ?? defaultFetch
  const loadAsset = options?.loadAsset
  const data = await fetchTiledMapData(url, fetchFn)
  const basePath = pixiPath.dirname(url)
  const { externalTilesets, templates } = await fetchMapDependencies(data, basePath, fetchFn)
  const mapData = await parseMapAsync(data, { externalTilesets, templates })
  const textures = await loadTextureManifest(collectTextureManifest(mapData, basePath), loadAsset)
  const container = new TiledMap(mapData, {
    tilesetTextures: textures.tilesetTextures,
    imageLayerTextures: textures.imageLayerTextures,
    tileImageTextures: textures.tileImageTextures,
    tileImageGifSources: textures.tileImageGifSources,
    imageLayerGifSources: textures.imageLayerGifSources
  })

  return { mapData, container }
}

function defaultFetch(url: string): ReturnType<FetchFn> {
  return DOMAdapter.get().fetch(url)
}

async function fetchTiledMapData(url: string, fetchFn: FetchFn): Promise<TiledMapData> {
  const ext = pixiPath.extname(url).toLowerCase()
  const response = await fetchFn(url)

  if (ext === '.tmx') {
    return parseTmx(await response.text())
  }

  return (await response.json()) as TiledMapData
}

export function collectTextureManifest(mapData: ResolvedMap, basePath: string): TextureManifest {
  const tilesetImages: TextureManifestEntry[] = []
  const tileImages: TextureManifestEntry[] = []
  const imageLayerImages: TextureManifestEntry[] = []

  for (const ts of mapData.tilesets) {
    if (ts.image) {
      tilesetImages.push({ source: ts.image, url: pixiPath.join(basePath, ts.image) })
    }

    for (const [_localId, tileDef] of ts.tiles) {
      if (tileDef.image) {
        tileImages.push({ source: tileDef.image, url: pixiPath.join(basePath, tileDef.image) })
      }
    }
  }

  for (const layer of flattenLayers(mapData.layers)) {
    if (layer.type === 'imagelayer' && layer.image) {
      imageLayerImages.push({ source: layer.image, url: pixiPath.join(basePath, layer.image) })
    }
  }

  return { tilesetImages, tileImages, imageLayerImages }
}

export async function loadTextureManifest(
  manifest: TextureManifest,
  loadAsset: LoadAssetFn = (url) => Assets.load(url)
): Promise<LoadedTextureSets> {
  const loaded: LoadedTextureSets = {
    tilesetTextures: new Map(),
    imageLayerTextures: new Map(),
    tileImageTextures: new Map(),
    tileImageGifSources: new Map(),
    imageLayerGifSources: new Map()
  }

  await Promise.all([
    ...manifest.tilesetImages.map((entry) =>
      loadAsset<Texture | GifSource>(entry.url).then((asset) => {
        loaded.tilesetTextures.set(entry.source, firstTexture(asset, entry.url))
      })
    ),
    ...manifest.tileImages.map((entry) =>
      loadAsset<Texture | GifSource>(entry.url).then((asset) => {
        if (isGifUrl(entry.url)) {
          const gifSource = asset as GifSource
          loaded.tileImageTextures.set(entry.source, gifSource.textures[0] as Texture)
          loaded.tileImageGifSources.set(entry.source, gifSource)
        } else {
          loaded.tileImageTextures.set(entry.source, asset as Texture)
        }
      })
    ),
    ...manifest.imageLayerImages.map((entry) =>
      loadAsset<Texture | GifSource>(entry.url).then((asset) => {
        if (isGifUrl(entry.url)) {
          const gifSource = asset as GifSource
          loaded.imageLayerTextures.set(entry.source, gifSource.textures[0] as Texture)
          loaded.imageLayerGifSources.set(entry.source, gifSource)
        } else {
          loaded.imageLayerTextures.set(entry.source, asset as Texture)
        }
      })
    )
  ])

  return loaded
}

function firstTexture(asset: Texture | GifSource, url: string): Texture {
  return isGifUrl(url) ? ((asset as GifSource).textures[0] as Texture) : (asset as Texture)
}

function isGifUrl(url: string): boolean {
  return url.toLowerCase().endsWith('.gif')
}

function flattenLayers<L extends { type: string; layers?: L[] }>(layers: L[]): L[] {
  const result: L[] = []
  for (const layer of layers) {
    result.push(layer)
    if (layer.type === 'group' && layer.layers) {
      result.push(...flattenLayers(layer.layers))
    }
  }
  return result
}

function* walkObjects(layers: TiledLayer[]): Generator<TiledObject> {
  for (const layer of flattenLayers(layers)) {
    if (layer.type === 'objectgroup' && layer.objects) {
      for (const obj of layer.objects) yield obj
    }
  }
}
