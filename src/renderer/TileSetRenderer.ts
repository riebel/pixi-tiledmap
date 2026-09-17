import { Rectangle, Texture } from 'pixi.js'
import type { GifSource } from 'pixi.js/gif'
import type { MapContext, ResolvedTileset, TiledTileDefinition } from '../types'
import { acquireColorKeyedTexture, releaseColorKeyedTexture } from './colorKey.js'

export class TileSetRenderer {
  readonly tileset: ResolvedTileset
  readonly baseTexture: Texture | null
  private readonly _ownedTextures = new Map<number, Texture>()
  private readonly _externalTextures = new Map<number, Texture>()
  /** Parts of supplied tile images; this renderer made them and destroys them. */
  private readonly _subTextures = new Map<number, Texture>()
  private readonly _gifSources = new Map<number, GifSource>()
  // Per-localId cached render dimensions (keyed by localId, value = width | height<<32
  // is not feasible for floats, so we use two parallel maps).
  private _renderWidthCache: Map<number, number> | null = null
  private _renderHeightCache: Map<number, number> | null = null
  private _cachedCtxTileWidth = 0
  private _cachedCtxTileHeight = 0

  /** The color-keyed copy of the atlas this renderer holds and must release. */
  private readonly _keyedBaseTexture: Texture | null = null

  constructor(tileset: ResolvedTileset, baseTexture: Texture | null) {
    this.tileset = tileset
    const keyed =
      baseTexture && tileset.transparentcolor
        ? acquireColorKeyedTexture(baseTexture, tileset.transparentcolor)
        : null
    this._keyedBaseTexture = keyed
    this.baseTexture = keyed ?? baseTexture
  }

  getTexture(localId: number): Texture | null {
    const external = this._externalTextures.get(localId)
    if (external) return external

    const owned = this._ownedTextures.get(localId)
    if (owned) return owned

    const tileDef = this.tileset.tiles.get(localId)

    // Image-collection tile with no externally supplied texture yet.
    if (tileDef?.image) return null

    // Single-image tileset: cut sub-rectangle from baseTexture
    if (!this.baseTexture) return null

    const { tilewidth, tileheight, columns, margin, spacing } = this.tileset
    if (columns <= 0) return null

    const col = localId % columns
    const row = Math.floor(localId / columns)
    const x = margin + col * (tilewidth + spacing)
    const y = margin + row * (tileheight + spacing)

    const frame = new Rectangle(x, y, tilewidth, tileheight)
    const texture = new Texture({ source: this.baseTexture.source, frame })

    this._ownedTextures.set(localId, texture)
    return texture
  }

  /**
   * Supplies an image-collection tile's image. A tile may use only part of it
   * (Tiled 1.9 tile `x`/`y`/`width`/`height`); that part is cut out here, once.
   */
  setTileTexture(localId: number, texture: Texture): void {
    this._subTextures.get(localId)?.destroy()
    this._subTextures.delete(localId)

    const tileDef = this.tileset.tiles.get(localId)
    const rect = tileDef && imageSubRect(tileDef, texture)
    if (!rect) {
      this._externalTextures.set(localId, texture)
      return
    }
    rect.x += texture.frame.x
    rect.y += texture.frame.y
    const sub = new Texture({ source: texture.source, frame: rect })
    this._subTextures.set(localId, sub)
    this._externalTextures.set(localId, sub)
  }

  setGifSource(localId: number, source: GifSource): void {
    this._gifSources.set(localId, source)
  }

  getGifSource(localId: number): GifSource | null {
    return this._gifSources.get(localId) ?? null
  }

  getAnimationFrames(localId: number): TiledTileDefinition['animation'] | undefined {
    return this.tileset.tiles.get(localId)?.animation
  }

  /**
   * Returns the intrinsic pixel size of a tile based on tileset metadata.
   * For image-collection tilesets, each tile has its own image dimensions.
   * For regular tilesets, all tiles share the tileset's tilewidth/tileheight.
   */
  getTileSize(localId: number): { width: number; height: number } {
    return { width: this.getTileWidth(localId), height: this.getTileHeight(localId) }
  }

  /** The intrinsic width of a tile (scalar, no allocation). */
  getTileWidth(localId: number): number {
    const tileDef = this.tileset.tiles.get(localId)
    if (!tileDef?.image) return this.tileset.tilewidth
    return tileDef.width ?? tileDef.imagewidth ?? this.tileset.tilewidth
  }

  /** The intrinsic height of a tile (scalar, no allocation). */
  getTileHeight(localId: number): number {
    const tileDef = this.tileset.tiles.get(localId)
    if (!tileDef?.image) return this.tileset.tileheight
    return tileDef.height ?? tileDef.imageheight ?? this.tileset.tileheight
  }

  /**
   * Returns the pixel size a tile should be drawn at on the map grid.
   * Allocates a new object - prefer `getRenderWidth`/`getRenderHeight`
   * in hot loops to avoid GC pressure.
   */
  getRenderSize(localId: number, ctx: MapContext): { width: number; height: number } {
    return {
      width: this.getRenderWidth(localId, ctx),
      height: this.getRenderHeight(localId, ctx)
    }
  }

  /**
   * Returns the rendered width of a tile (scalar, no allocation).
   * Results are cached per localId for the lifetime of a single map context.
   */
  getRenderWidth(localId: number, ctx: MapContext): number {
    this._ensureRenderCache(ctx)
    return this._renderWidthCache!.get(localId) ?? this._cacheRenderSize(localId, ctx).width
  }

  /**
   * Returns the rendered height of a tile (scalar, no allocation).
   */
  getRenderHeight(localId: number, ctx: MapContext): number {
    this._ensureRenderCache(ctx)
    return this._renderHeightCache!.get(localId) ?? this._cacheRenderSize(localId, ctx).height
  }

  private _ensureRenderCache(ctx: MapContext): void {
    if (
      this._renderWidthCache &&
      this._cachedCtxTileWidth === ctx.tilewidth &&
      this._cachedCtxTileHeight === ctx.tileheight
    ) {
      return
    }
    this._renderWidthCache = new Map()
    this._renderHeightCache = new Map()
    this._cachedCtxTileWidth = ctx.tilewidth
    this._cachedCtxTileHeight = ctx.tileheight
  }

  private _cacheRenderSize(localId: number, ctx: MapContext): { width: number; height: number } {
    const size = this._computeRenderSize(localId, ctx)
    this._renderWidthCache!.set(localId, size.width)
    this._renderHeightCache!.set(localId, size.height)
    return size
  }

  private _computeRenderSize(localId: number, ctx: MapContext): { width: number; height: number } {
    const intrinsic = this.getTileSize(localId)
    if (this.tileset.tilerendersize !== 'grid') return intrinsic

    const gridW = ctx.tilewidth
    const gridH = ctx.tileheight

    if (this.tileset.fillmode === 'preserve-aspect-fit') {
      if (intrinsic.width === 0 || intrinsic.height === 0) {
        return { width: gridW, height: gridH }
      }
      const scale = Math.min(gridW / intrinsic.width, gridH / intrinsic.height)
      return { width: intrinsic.width * scale, height: intrinsic.height * scale }
    }

    return { width: gridW, height: gridH }
  }

  /**
   * Destroys the textures this renderer made. Pass `keepTextures` while
   * visuals built from them outlive the renderer, such as tile layers detached
   * from a destroyed map; the textures are then left to them.
   */
  destroy(keepTextures = false): void {
    if (!keepTextures) {
      for (const tex of this._ownedTextures.values()) tex.destroy()
      for (const tex of this._subTextures.values()) tex.destroy()
      if (this._keyedBaseTexture) releaseColorKeyedTexture(this._keyedBaseTexture)
    }
    this._ownedTextures.clear()
    this._subTextures.clear()
    this._externalTextures.clear()
    this._gifSources.clear()
    this._renderWidthCache = null
    this._renderHeightCache = null
  }
}

function imageSubRect(tileDef: TiledTileDefinition, texture: Texture): Rectangle | null {
  const { frame } = texture
  const x = tileDef.x ?? 0
  const y = tileDef.y ?? 0
  const rect = new Rectangle(
    x,
    y,
    tileDef.width ?? frame.width - x,
    tileDef.height ?? frame.height - y
  )
  return isPartOf(rect, frame) ? rect : null
}

/** Whether `rect` is a non-empty region smaller than the whole `frame`. */
function isPartOf(rect: Rectangle, frame: Rectangle): boolean {
  if (rect.width <= 0 || rect.height <= 0) return false
  return rect.x !== 0 || rect.y !== 0 || rect.width !== frame.width || rect.height !== frame.height
}
