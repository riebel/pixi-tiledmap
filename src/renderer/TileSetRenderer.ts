import { Rectangle, Texture } from 'pixi.js'
import type { ResolvedTileset, TiledTileDefinition } from '../types'

export class TileSetRenderer {
  readonly tileset: ResolvedTileset
  readonly baseTexture: Texture | null
  private readonly _textureCache = new Map<number, Texture>()

  constructor(tileset: ResolvedTileset, baseTexture: Texture | null) {
    this.tileset = tileset
    this.baseTexture = baseTexture
  }

  getTexture(localId: number): Texture | null {
    const cached = this._textureCache.get(localId)
    if (cached) return cached

    const tileDef = this.tileset.tiles.get(localId)

    // Image-collection tileset: each tile has its own image (loaded separately)
    if (tileDef?.image) {
      // For image-collection tilesets, textures must be supplied externally
      // via setTileTexture(). Return null here.
      return null
    }

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

    this._textureCache.set(localId, texture)
    return texture
  }

  setTileTexture(localId: number, texture: Texture): void {
    this._textureCache.set(localId, texture)
  }

  getAnimationFrames(localId: number): TiledTileDefinition['animation'] | undefined {
    return this.tileset.tiles.get(localId)?.animation
  }

  /**
   * Returns the intrinsic pixel size of a tile based on tileset metadata.
   * For image-collection tilesets, each tile has its own image dimensions.
   * For regular tilesets, all tiles share the tileset's tilewidth/tileheight.
   *
   * This does not read from the pixi Texture, so it is safe to call before
   * textures have finished loading.
   */
  getTileSize(localId: number): { width: number; height: number } {
    const tileDef = this.tileset.tiles.get(localId)
    if (tileDef?.image) {
      return {
        width: tileDef.imagewidth ?? this.tileset.tilewidth,
        height: tileDef.imageheight ?? this.tileset.tileheight
      }
    }
    return { width: this.tileset.tilewidth, height: this.tileset.tileheight }
  }

  destroy(): void {
    for (const tex of this._textureCache.values()) {
      tex.destroy()
    }
    this._textureCache.clear()
  }
}
