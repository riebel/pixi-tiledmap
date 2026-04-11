import { Assets, ExtensionType, type LoaderParser, path as pixiPath, type Texture } from 'pixi.js'
import { parseMapAsync, parseTmx, parseTsx } from '../parser'
import type { ResolvedLayer, TiledMapAsset, TiledMap as TiledMapData, TiledTileset } from '../types'
import { TiledMap } from './TiledMap.js'

function isXmlExt(ext: string): boolean {
  return ext === '.tmx'
}

function isTsxExt(ext: string): boolean {
  return ext === '.tsx'
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
    const ext = pixiPath.extname(url).toLowerCase()
    const response = await fetch(url)

    let data: TiledMapData
    if (isXmlExt(ext)) {
      const xml = await response.text()
      data = parseTmx(xml)
    } else {
      data = (await response.json()) as TiledMapData
    }

    const basePath = pixiPath.dirname(url)

    // Resolve external tilesets
    const externalTilesets = new Map<string, TiledTileset>()
    for (const ts of data.tilesets) {
      if ('source' in ts && !('name' in ts)) {
        const tsUrl = pixiPath.join(basePath, ts.source)
        const tsResponse = await fetch(tsUrl)
        const tsExt = pixiPath.extname(ts.source).toLowerCase()
        let tsData: TiledTileset
        if (isTsxExt(tsExt)) {
          const tsXml = await tsResponse.text()
          tsData = parseTsx(tsXml)
        } else {
          tsData = (await tsResponse.json()) as TiledTileset
        }
        externalTilesets.set(ts.source, tsData)
      }
    }

    // Parse the map to resolved IR
    const mapData = await parseMapAsync(data, { externalTilesets })

    // Load tileset textures
    const tilesetTextures = new Map<string, Texture>()
    const imageLayerTextures = new Map<string, Texture>()
    const tileImageTextures = new Map<string, Texture>()

    const textureLoads: Promise<void>[] = []

    for (const ts of mapData.tilesets) {
      if (ts.image) {
        const imageUrl = pixiPath.join(basePath, ts.image)
        textureLoads.push(
          Assets.load<Texture>(imageUrl).then((tex) => {
            tilesetTextures.set(ts.image!, tex)
          })
        )
      }

      // Image-collection tilesets: each tile has its own image
      for (const [_localId, tileDef] of ts.tiles) {
        if (tileDef.image) {
          const tileImgUrl = pixiPath.join(basePath, tileDef.image)
          textureLoads.push(
            Assets.load<Texture>(tileImgUrl).then((tex) => {
              tileImageTextures.set(tileDef.image!, tex)
            })
          )
        }
      }
    }

    // Load image layer textures
    for (const layer of flattenLayers(mapData.layers)) {
      if (layer.type === 'imagelayer' && layer.image) {
        const imgUrl = pixiPath.join(basePath, layer.image)
        textureLoads.push(
          Assets.load<Texture>(imgUrl).then((tex) => {
            imageLayerTextures.set(layer.image, tex)
          })
        )
      }
    }

    await Promise.all(textureLoads)

    // Build the display tree
    const container = new TiledMap(mapData, {
      tilesetTextures,
      imageLayerTextures,
      tileImageTextures
    })

    return { mapData, container }
  }
}

function flattenLayers(layers: ResolvedLayer[]): ResolvedLayer[] {
  const result: ResolvedLayer[] = []
  for (const layer of layers) {
    result.push(layer)
    if (layer.type === 'group') {
      result.push(...flattenLayers(layer.layers))
    }
  }
  return result
}
