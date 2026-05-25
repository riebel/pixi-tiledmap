import { Container, Graphics, Rectangle } from 'pixi.js'
import type { GifSource } from 'pixi.js/gif'
import { resolveTileInput } from '../resolvedTile.js'
import type {
  MapContext,
  ResolvedMap,
  ResolvedTile,
  TiledMapOptions,
  TiledTileInput,
  TiledTileLayerSelector
} from '../types'
import { findLayerByName, findTileLayerRenderer } from './layerTreeLookup.js'
import { applyParallaxToLayerTree, renderLayerTree } from './layerTreeRenderer.js'
import { computeMapPixelSize } from './mapSize.js'
import { parseTintColor } from './parseColor.js'
import type { TileLayerRenderer } from './TileLayerRenderer.js'
import { TileSetRenderer } from './TileSetRenderer.js'

export class TiledMap extends Container {
  readonly mapData: ResolvedMap
  readonly tileSetRenderers: TileSetRenderer[]

  private _background: Graphics | null = null

  constructor(mapData: ResolvedMap, options?: TiledMapOptions) {
    super()

    this.mapData = mapData
    this.label = 'TiledMap'

    const pixelSize = computeMapPixelSize(mapData)

    // Force local bounds to the logical map size. Without this, pixi's
    // .width/.height setters (and getLocalBounds) would use the extent of
    // the rendered children - which misbehaves when the map has empty
    // top/left rows (bounds.minY > 0, causing content to overflow the
    // canvas when scaling via `.height = ...`) or when tall decoration
    // tiles extend beyond the grid.
    this.boundsArea = new Rectangle(0, 0, pixelSize.width, pixelSize.height)

    // Build tileset renderers
    const tilesetTextures = options?.tilesetTextures ?? new Map()
    const imageLayerTextures = options?.imageLayerTextures ?? new Map()
    const tileImageTextures = options?.tileImageTextures ?? new Map()
    const tileImageGifSources = options?.tileImageGifSources ?? new Map<string, GifSource>()
    const imageLayerGifSources = options?.imageLayerGifSources ?? new Map<string, GifSource>()

    this.tileSetRenderers = mapData.tilesets.map((ts) => {
      const baseTex = ts.image ? (tilesetTextures.get(ts.image) ?? null) : null
      const renderer = new TileSetRenderer(ts, baseTex)

      // Supply individual tile images for image-collection tilesets
      for (const [localId, tileDef] of ts.tiles) {
        if (tileDef.image) {
          const tex = tileImageTextures.get(tileDef.image)
          if (tex) renderer.setTileTexture(localId, tex)
          const gifSource = tileImageGifSources.get(tileDef.image)
          if (gifSource) renderer.setGifSource(localId, gifSource)
        }
      }

      return renderer
    })

    // Build map context for orientation-aware tile placement
    const ctx: MapContext = {
      orientation: mapData.orientation,
      renderorder: mapData.renderorder,
      tilewidth: mapData.tilewidth,
      tileheight: mapData.tileheight,
      hexsidelength: mapData.hexsidelength,
      staggeraxis: mapData.staggeraxis,
      staggerindex: mapData.staggerindex,
      mapPixelWidth: pixelSize.width,
      mapPixelHeight: pixelSize.height,
      tileSpritePadding: options?.tileSpritePadding ?? 0.01
    }
    // Render background
    if (mapData.backgroundcolor) {
      this._buildBackground(pixelSize.width, pixelSize.height, mapData.backgroundcolor)
    }

    // Render layers
    const layerContext = {
      tilesets: this.tileSetRenderers,
      mapContext: ctx,
      imageTextures: imageLayerTextures,
      imageGifSources: imageLayerGifSources,
      layerFilter: options?.layerFilter
    }
    const renderedLayers = renderLayerTree(mapData.layers, layerContext)
    if (renderedLayers.length > 0) this.addChild(...renderedLayers)
  }

  get orientation() {
    return this.mapData.orientation
  }
  get mapWidth() {
    return this.mapData.width
  }
  get mapHeight() {
    return this.mapData.height
  }
  get tileWidth() {
    return this.mapData.tilewidth
  }
  get tileHeight() {
    return this.mapData.tileheight
  }

  getLayer(name: string): Container | undefined {
    return findLayerByName(this.children, name) ?? undefined
  }

  getTile(layer: TiledTileLayerSelector, col: number, row: number): ResolvedTile | null {
    return this._getTileLayerRenderer(layer).getTile(col, row)
  }

  setTile(layer: TiledTileLayerSelector, col: number, row: number, tile: TiledTileInput): void {
    this._getTileLayerRenderer(layer).setTile(
      col,
      row,
      resolveTileInput(tile, this.mapData.tilesets)
    )
  }

  clearTile(layer: TiledTileLayerSelector, col: number, row: number): void {
    this._getTileLayerRenderer(layer).clearTile(col, row)
  }

  /**
   * Reposition layers to reflect the camera's current position through the
   * map's parallax factors. Call after moving the camera.
   *
   * Effective layer screen position (after your camera transform) is:
   *   base_offset - parallax_origin * (1 - parallax) - camera * parallax
   *
   * so a layer with parallax 1 moves normally with the camera and a layer
   * with parallax 0 is pinned in screen space. Nested group layers compose
   * parallax multiplicatively per the Tiled spec.
   */
  applyParallax(cameraX: number, cameraY: number): void {
    const ox = this.mapData.parallaxoriginx
    const oy = this.mapData.parallaxoriginy
    applyParallaxToLayerTree(this.children, cameraX, cameraY, ox, oy)
  }

  private _buildBackground(pixelWidth: number, pixelHeight: number, colorHex: string): void {
    const color = parseTintColor(colorHex)
    this._background = new Graphics().rect(0, 0, pixelWidth, pixelHeight).fill(color)
    this._background.label = 'background'
    this.addChild(this._background)
  }

  private _getTileLayerRenderer(selector: TiledTileLayerSelector): TileLayerRenderer {
    const layer = findTileLayerRenderer(this.children, selector)
    if (!layer) {
      throw new Error(`Tile layer "${selector}" is not rendered in this TiledMap.`)
    }
    return layer
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    for (const ts of this.tileSetRenderers) {
      ts.destroy()
    }
    super.destroy(options)
  }
}
