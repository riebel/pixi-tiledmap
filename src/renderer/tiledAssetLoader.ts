import {
  Assets,
  DOMAdapter,
  ExtensionType,
  extensions,
  type LoaderParser,
  path as pixiPath,
  type SCALE_MODE,
  type Texture
} from 'pixi.js'
import type { GifSource } from 'pixi.js/gif'
import { GifAsset } from 'pixi.js/gif'
import { parseMapAsync, parseTmx, parseTsx, parseTx } from '../parser'
import { joinRelativePath } from '../parser/relativePath.js'
import { isTilesetRef } from '../parser/tilesetHelpers.js'
import type {
  ResolvedMap,
  TiledLayer,
  TiledMap as TiledMapData,
  TiledMapOptions,
  TiledObject,
  TiledObjectTemplate,
  TiledTilesetFile
} from '../types'
import { TiledMap } from './TiledMap.js'

extensions.add(GifAsset)

export type FetchFn = ReturnType<typeof DOMAdapter.get>['fetch']
export type LoadAssetFn = <T>(url: string) => Promise<T>

export interface TiledAssetPipelineOptions {
  fetchFn?: FetchFn
  loadAsset?: LoadAssetFn
  mapOptions?: Pick<TiledMapOptions, 'layerFilter' | 'tileSpritePadding' | 'tileMeshBatchSize'>
  /**
   * Scale mode applied to every texture source the map loads. Defaults to
   * `'nearest'`, so tile edges stay sharp and neighbouring atlas cells do not
   * bleed into each other when the map is scaled. The sources are shared
   * through the `Assets` cache, so this also applies to other users of the
   * same images. Pass `null` to keep each source's own scale mode.
   */
  scaleMode?: SCALE_MODE | null
}

export interface TiledMapAsset {
  mapData: ResolvedMap
  /**
   * The rendered map. PixiJS caches loaded assets, so every `Assets.load` of
   * the same URL returns this same container. Once it has been destroyed, the
   * next read builds a fresh one from `mapData` and the already loaded textures.
   */
  container: TiledMap
}

/** The container an asset currently holds, read without rebuilding a destroyed one. */
const currentContainers = new WeakMap<TiledMapAsset, () => TiledMap>()

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
  fetchFn: FetchFn = DOMAdapter.get().fetch
): Promise<{
  externalTilesets: Map<string, TiledTilesetFile>
  templates: Map<string, TiledObjectTemplate>
}> {
  const externalTilesets = new Map<string, TiledTilesetFile>()
  const tilesetSources = new Set<string>()
  for (const ts of data.tilesets) {
    if (isTilesetRef(ts)) tilesetSources.add(ts.source)
  }
  const loadedTilesets = await Promise.all(
    Array.from(tilesetSources).map(async (src) => {
      const tsUrl = resolveAssetUrl(basePath, src)
      const tsResponse = await fetchFn(tsUrl)
      assertSuccessfulResponse(tsResponse, tsUrl)
      const tsExt = pixiPath.extname(src).toLowerCase()
      const tileset =
        tsExt === '.tsx'
          ? parseTsx(await tsResponse.text())
          : ((await tsResponse.json()) as TiledTilesetFile)
      return [src, rebaseTilesetImages(tileset, pixiPath.dirname(src))] as const
    })
  )
  // Keep the map's tileset order, whatever order the fetches finish in.
  for (const [src, tileset] of loadedTilesets) externalTilesets.set(src, tileset)

  const templates = new Map<string, TiledObjectTemplate>()
  const templateSources = new Set<string>()
  for (const obj of walkObjects(data.layers)) {
    if (obj.template) templateSources.add(obj.template)
  }
  await Promise.all(
    Array.from(templateSources).map(async (src) => {
      const tplUrl = resolveAssetUrl(basePath, src)
      const tplResponse = await fetchFn(tplUrl)
      assertSuccessfulResponse(tplResponse, tplUrl)
      const tplExt = pixiPath.extname(src).toLowerCase()
      const template =
        tplExt === '.tx'
          ? parseTx(await tplResponse.text())
          : ((await tplResponse.json()) as TiledObjectTemplate)
      templates.set(src, rebaseTemplateTilesetSource(template, pixiPath.dirname(src)))
    })
  )

  return { externalTilesets, templates }
}

export const tiledMapLoader: LoaderParser<TiledMapAsset, TiledAssetPipelineOptions> = {
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

  async load(url, resolvedAsset): Promise<TiledMapAsset> {
    return loadTiledMapAsset(url, resolvedAsset?.data)
  },

  unload(asset): void {
    // Children go down with the map so animated tiles leave the shared ticker.
    // Textures stay: they are separate Assets cache entries other maps may share.
    currentContainers.get(asset)?.().destroy({ children: true })
  }
}

export async function loadTiledMapAsset(
  url: string,
  options?: TiledAssetPipelineOptions
): Promise<TiledMapAsset> {
  const fetchFn = options?.fetchFn ?? DOMAdapter.get().fetch
  const loadAsset = options?.loadAsset
  const data = await fetchTiledMapData(url, fetchFn)
  const basePath = pixiPath.dirname(url)
  const { externalTilesets, templates } = await fetchMapDependencies(data, basePath, fetchFn)
  const mapData = await parseMapAsync(data, { externalTilesets, templates })
  const textures = await loadTextureManifest(collectTextureManifest(mapData, basePath), loadAsset)
  const scaleMode = options?.scaleMode === undefined ? 'nearest' : options.scaleMode
  if (scaleMode) applyScaleMode(textures, scaleMode)
  const mapOptions: TiledMapOptions = {
    ...options?.mapOptions,
    tilesetTextures: textures.tilesetTextures,
    imageLayerTextures: textures.imageLayerTextures,
    tileImageTextures: textures.tileImageTextures,
    tileImageGifSources: textures.tileImageGifSources,
    imageLayerGifSources: textures.imageLayerGifSources
  }
  let container = new TiledMap(mapData, mapOptions)

  // The asset outlives any one container: the Assets cache hands this object
  // back on every load, including after the caller destroyed the container.
  const asset: TiledMapAsset = {
    mapData,
    get container(): TiledMap {
      if (container.destroyed) container = new TiledMap(mapData, mapOptions)
      return container
    }
  }
  currentContainers.set(asset, () => container)
  return asset
}

async function fetchTiledMapData(url: string, fetchFn: FetchFn): Promise<TiledMapData> {
  const ext = pixiPath.extname(url).toLowerCase()
  const response = await fetchFn(url)
  assertSuccessfulResponse(response, url)

  if (ext === '.tmx') {
    return parseTmx(await response.text())
  }

  return (await response.json()) as TiledMapData
}

function collectTextureManifest(mapData: ResolvedMap, basePath: string): TextureManifest {
  const tilesetImages: TextureManifestEntry[] = []
  const tileImages: TextureManifestEntry[] = []
  const imageLayerImages: TextureManifestEntry[] = []

  for (const ts of mapData.tilesets) {
    if (ts.image) {
      tilesetImages.push({ source: ts.image, url: resolveAssetUrl(basePath, ts.image) })
    }

    for (const [_localId, tileDef] of ts.tiles) {
      if (tileDef.image) {
        tileImages.push({ source: tileDef.image, url: resolveAssetUrl(basePath, tileDef.image) })
      }
    }
  }

  for (const layer of flattenLayers(mapData.layers)) {
    if (layer.type === 'imagelayer' && layer.image) {
      imageLayerImages.push({ source: layer.image, url: resolveAssetUrl(basePath, layer.image) })
    }
  }

  return { tilesetImages, tileImages, imageLayerImages }
}

/** Resolve a Tiled asset reference without corrupting absolute or protocol URLs. */
export function resolveAssetUrl(basePath: string, source: string): string {
  if (isRootedPath(source)) return source
  if (isRootedPath(basePath)) return pixiPath.join(basePath, source)
  // Unlike `pixiPath.join`, this keeps a `..` that climbs above `basePath`, so
  // a tileset in a sibling directory of the map is not moved into the map directory.
  return joinRelativePath(pixiPath.toPosix(basePath), pixiPath.toPosix(source))
}

function isRootedPath(path: string): boolean {
  return (
    pixiPath.isAbsolute(path) ||
    pixiPath.isUrl(path) ||
    pixiPath.isDataUrl(path) ||
    pixiPath.isBlobUrl(path) ||
    pixiPath.hasProtocol(path)
  )
}

/**
 * Normalize image paths owned by an external tileset into map-relative keys.
 * The resolved map, texture manifest, and renderer then share the exact same key.
 */
export function rebaseTilesetImages(
  tileset: TiledTilesetFile,
  tilesetBase: string
): TiledTilesetFile {
  return {
    ...tileset,
    ...(tileset.image ? { image: resolveAssetUrl(tilesetBase, tileset.image) } : {}),
    ...(tileset.tiles
      ? {
          tiles: tileset.tiles.map((tile) =>
            tile.image ? { ...tile, image: resolveAssetUrl(tilesetBase, tile.image) } : tile
          )
        }
      : {})
  }
}

function rebaseTemplateTilesetSource(
  template: TiledObjectTemplate,
  templateBase: string
): TiledObjectTemplate {
  const tileset = template.tileset
  if (!tileset?.source) return template

  return {
    ...template,
    tileset: {
      ...tileset,
      source: resolveAssetUrl(templateBase, tileset.source)
    }
  }
}

function assertSuccessfulResponse(response: Response, url: string): void {
  // Only an explicit HTTP failure is an error. Custom fetch adapters may omit
  // `ok`, and `file://` responses report status 0 while carrying the body.
  if (response.ok !== false || response.status === 0) return

  const status = response.statusText ? `${response.status} ${response.statusText}` : response.status
  throw new Error(`Failed to fetch Tiled asset "${url}": ${status}`)
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

function applyScaleMode(textures: LoadedTextureSets, scaleMode: SCALE_MODE): void {
  const sets = [textures.tilesetTextures, textures.imageLayerTextures, textures.tileImageTextures]
  for (const set of sets) {
    for (const texture of set.values()) texture.source.scaleMode = scaleMode
  }
  // Every GIF frame has its own source; only the first one is in the texture maps.
  for (const set of [textures.tileImageGifSources, textures.imageLayerGifSources]) {
    for (const gifSource of set.values()) {
      for (const frame of gifSource.textures) frame.source.scaleMode = scaleMode
    }
  }
}

function firstTexture(asset: Texture | GifSource, url: string): Texture {
  return isGifUrl(url) ? ((asset as GifSource).textures[0] as Texture) : (asset as Texture)
}

function isGifUrl(url: string): boolean {
  return new URL(url, 'https://pixi-tiledmap.invalid').pathname.toLowerCase().endsWith('.gif')
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
