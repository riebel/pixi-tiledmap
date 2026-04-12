import { Rectangle, Texture } from 'pixi.js'
import type { ResolvedTileset, TiledTileDefinition } from '../types'
import type { MapContext } from './tilePlacement.js'

export class TileSetRenderer {
  readonly tileset: ResolvedTileset
  readonly baseTexture: Texture | null
  private readonly _ownedTextures = new Map<number, Texture>()
  private readonly _externalTextures = new Map<number, Texture>()

  constructor(tileset: ResolvedTileset, baseTexture: Texture | null) {
    this.tileset = tileset
    this.baseTexture = baseTexture
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

  setTileTexture(localId: number, texture: Texture): void {
    this._externalTextures.set(localId, texture)
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

  /**
   * Returns the pixel size a tile should be drawn at on the map grid.
   * When `tilerendersize === 'grid'`, the tile is resized to the map cell
   * size, honouring `fillmode` for non-stretch aspect handling.
   * Otherwise the tile's intrinsic size is used.
   */
  getRenderSize(localId: number, ctx: MapContext): { width: number; height: number } {
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

  destroy(): void {
    for (const tex of this._ownedTextures.values()) {
      tex.destroy()
    }
    this._ownedTextures.clear()
    this._externalTextures.clear()
  }
}
