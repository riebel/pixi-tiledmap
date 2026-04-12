import { Container, Graphics, Rectangle } from 'pixi.js'
import type { MapContext, ResolvedMap, TiledMapOptions } from '../types'
import { createLayerRenderer } from './createLayerRenderer.js'
import { GroupLayerRenderer } from './GroupLayerRenderer.js'
import { ImageLayerRenderer } from './ImageLayerRenderer.js'
import { ObjectLayerRenderer } from './ObjectLayerRenderer.js'
import { parseTintColor } from './parseColor.js'
import { TileLayerRenderer } from './TileLayerRenderer.js'
import { TileSetRenderer } from './TileSetRenderer.js'

type ParallaxLayer =
  | TileLayerRenderer
  | ImageLayerRenderer
  | ObjectLayerRenderer
  | GroupLayerRenderer

function isParallaxLayer(c: Container): c is ParallaxLayer {
  return (
    c instanceof TileLayerRenderer ||
    c instanceof ImageLayerRenderer ||
    c instanceof ObjectLayerRenderer ||
    c instanceof GroupLayerRenderer
  )
}

export class TiledMap extends Container {
  readonly mapData: ResolvedMap
  readonly tileSetRenderers: TileSetRenderer[]

  private _background: Graphics | null = null

  constructor(mapData: ResolvedMap, options?: TiledMapOptions) {
    super()

    this.mapData = mapData
    this.label = 'TiledMap'

    // Force local bounds to the logical map size. Without this, pixi's
    // .width/.height setters (and getLocalBounds) would use the extent of
    // the rendered children — which misbehaves when the map has empty
    // top/left rows (bounds.minY > 0, causing content to overflow the
    // canvas when scaling via `.height = ...`) or when tall decoration
    // tiles extend beyond the grid.
    this.boundsArea = new Rectangle(
      0,
      0,
      this._computePixelWidth(mapData),
      this._computePixelHeight(mapData)
    )

    // Build tileset renderers
    const tilesetTextures = options?.tilesetTextures ?? new Map()
    const imageLayerTextures = options?.imageLayerTextures ?? new Map()
    const tileImageTextures = options?.tileImageTextures ?? new Map()

    this.tileSetRenderers = mapData.tilesets.map((ts) => {
      const baseTex = ts.image ? (tilesetTextures.get(ts.image) ?? null) : null
      const renderer = new TileSetRenderer(ts, baseTex)

      // Supply individual tile images for image-collection tilesets
      for (const [localId, tileDef] of ts.tiles) {
        if (tileDef.image) {
          const tex = tileImageTextures.get(tileDef.image)
          if (tex) renderer.setTileTexture(localId, tex)
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
      staggerindex: mapData.staggerindex
    }

    // Render background
    if (mapData.backgroundcolor) {
      this._buildBackground(mapData)
    }

    // Render layers
    for (const layer of mapData.layers) {
      const child = createLayerRenderer(layer, this.tileSetRenderers, ctx, imageLayerTextures)
      if (child) this.addChild(child)
    }
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
    return this.children.find((c) => c.label === name) as Container | undefined
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
    for (const child of this.children) {
      if (isParallaxLayer(child)) {
        applyParallaxRecursive(child, cameraX, cameraY, ox, oy, 1, 1)
      }
    }
  }

  private _buildBackground(mapData: ResolvedMap): void {
    const color = parseTintColor(mapData.backgroundcolor!)
    const pixelWidth = this._computePixelWidth(mapData)
    const pixelHeight = this._computePixelHeight(mapData)

    this._background = new Graphics().rect(0, 0, pixelWidth, pixelHeight).fill(color)
    this._background.label = 'background'
    this.addChild(this._background)
  }

  private _computePixelWidth(mapData: ResolvedMap): number {
    switch (mapData.orientation) {
      case 'isometric':
        return (mapData.width + mapData.height) * (mapData.tilewidth / 2)
      case 'staggered':
      case 'hexagonal':
        return mapData.staggeraxis === 'x'
          ? (mapData.width + 1) * (mapData.tilewidth / 2)
          : mapData.width * mapData.tilewidth + mapData.tilewidth / 2
      default:
        return mapData.width * mapData.tilewidth
    }
  }

  private _computePixelHeight(mapData: ResolvedMap): number {
    switch (mapData.orientation) {
      case 'isometric':
        return (mapData.width + mapData.height) * (mapData.tileheight / 2)
      case 'staggered':
      case 'hexagonal':
        return mapData.staggeraxis === 'x'
          ? mapData.height * mapData.tileheight + mapData.tileheight / 2
          : (mapData.height + 1) * (mapData.tileheight / 2)
      default:
        return mapData.height * mapData.tileheight
    }
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    for (const ts of this.tileSetRenderers) {
      ts.destroy()
    }
    super.destroy(options)
  }
}

function applyParallaxRecursive(
  layer: ParallaxLayer,
  cameraX: number,
  cameraY: number,
  originX: number,
  originY: number,
  parentParallaxX: number,
  parentParallaxY: number
): void {
  const px = layer.layerParallaxX * parentParallaxX
  const py = layer.layerParallaxY * parentParallaxY

  layer.position.set(
    layer.layerBaseOffsetX + (cameraX - originX) * (1 - px),
    layer.layerBaseOffsetY + (cameraY - originY) * (1 - py)
  )

  if (layer instanceof GroupLayerRenderer) {
    for (const child of layer.children) {
      if (isParallaxLayer(child)) {
        applyParallaxRecursive(child, cameraX, cameraY, originX, originY, px, py)
      }
    }
  }
}
