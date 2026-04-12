import 'pixi.js/gif'
import {
  Assets,
  ExtensionType,
  extensions,
  type LoaderParser,
  path as pixiPath,
  type Texture
} from 'pixi.js'
import { GifAsset, type GifSource } from 'pixi.js/gif'
import { parseMapAsync, parseTmx, parseTsx, parseTx } from '../parser'
import { isTilesetRef } from '../parser/tilesetHelpers.js'
import type {
  TiledLayer,
  TiledMapAsset,
  TiledMap as TiledMapData,
  TiledObject,
  TiledObjectTemplate,
  TiledTileset
} from '../types'
import { TiledMap } from './TiledMap.js'

extensions.add(GifAsset)

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
    if (ext === '.tmx') {
      const xml = await response.text()
      data = parseTmx(xml)
    } else {
      data = (await response.json()) as TiledMapData
    }

    const basePath = pixiPath.dirname(url)

    // Resolve external tilesets
    const externalTilesets = new Map<string, TiledTileset>()
    for (const ts of data.tilesets) {
      if (!isTilesetRef(ts)) continue
      const tsUrl = pixiPath.join(basePath, ts.source)
      const tsResponse = await fetch(tsUrl)
      const tsExt = pixiPath.extname(ts.source).toLowerCase()
      let tsData: TiledTileset
      if (tsExt === '.tsx') {
        const tsXml = await tsResponse.text()
        tsData = parseTsx(tsXml)
      } else {
        tsData = (await tsResponse.json()) as TiledTileset
      }
      externalTilesets.set(ts.source, tsData)
    }

    // Resolve object templates — walk every object layer (including nested
    // group layers) to find unique template references, then fetch each one
    // in parallel. Templates may be either .tx (XML) or .tj (JSON).
    const templates = new Map<string, TiledObjectTemplate>()
    const templateSources = new Set<string>()
    for (const obj of walkObjects(data.layers)) {
      if (obj.template) templateSources.add(obj.template)
    }
    await Promise.all(
      Array.from(templateSources).map(async (src) => {
        const tplUrl = pixiPath.join(basePath, src)
        const tplResponse = await fetch(tplUrl)
        const tplExt = pixiPath.extname(src).toLowerCase()
        let tpl: TiledObjectTemplate
        if (tplExt === '.tx') {
          const tplXml = await tplResponse.text()
          tpl = parseTx(tplXml)
        } else {
          tpl = (await tplResponse.json()) as TiledObjectTemplate
        }
        templates.set(src, tpl)
      })
    )

    // Parse the map to resolved IR
    const mapData = await parseMapAsync(data, { externalTilesets, templates })

    // Load tileset textures
    const tilesetTextures = new Map<string, Texture>()
    const imageLayerTextures = new Map<string, Texture>()
    const tileImageTextures = new Map<string, Texture>()

    const textureLoads: Promise<void>[] = []

    for (const ts of mapData.tilesets) {
      if (ts.image) {
        const imageUrl = pixiPath.join(basePath, ts.image)
        textureLoads.push(
          Assets.load<Texture | GifSource>(imageUrl).then((tex) => {
            tilesetTextures.set(
              ts.image!,
              imageUrl.toLowerCase().endsWith('.gif')
                ? ((tex as GifSource).textures[0] as Texture)
                : (tex as Texture)
            )
          })
        )
      }

      // Image-collection tilesets: each tile has its own image
      for (const [_localId, tileDef] of ts.tiles) {
        if (tileDef.image) {
          const tileImgUrl = pixiPath.join(basePath, tileDef.image)
          textureLoads.push(
            Assets.load<Texture | GifSource>(tileImgUrl).then((tex) => {
              tileImageTextures.set(
                tileDef.image!,
                tileImgUrl.toLowerCase().endsWith('.gif')
                  ? ((tex as GifSource).textures[0] as Texture)
                  : (tex as Texture)
              )
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
          Assets.load<Texture | GifSource>(imgUrl).then((tex) => {
            imageLayerTextures.set(
              layer.image,
              imgUrl.toLowerCase().endsWith('.gif')
                ? ((tex as GifSource).textures[0] as Texture)
                : (tex as Texture)
            )
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
