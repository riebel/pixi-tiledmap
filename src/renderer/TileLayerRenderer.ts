import { AnimatedSprite, Container, Sprite, type Texture } from 'pixi.js'
import { GifSprite } from 'pixi.js/gif'
import type {
  MapContext,
  ResolvedChunk,
  ResolvedTile,
  ResolvedTileLayer,
  TiledFrame
} from '../types'
import { parseTintColor } from './parseColor.js'
import type { TileSetRenderer } from './TileSetRenderer.js'
import { tileToPixel } from './tilePlacement.js'

export class TileLayerRenderer extends Container {
  readonly layerData: ResolvedTileLayer
  readonly layerBaseOffsetX: number
  readonly layerBaseOffsetY: number
  readonly layerParallaxX: number
  readonly layerParallaxY: number

  constructor(layerData: ResolvedTileLayer, tilesets: TileSetRenderer[], ctx: MapContext) {
    super()

    this.layerData = layerData
    this.label = layerData.name
    this.alpha = layerData.opacity
    this.visible = layerData.visible
    this.layerBaseOffsetX = layerData.offsetx
    this.layerBaseOffsetY = layerData.offsety
    this.layerParallaxX = layerData.parallaxx
    this.layerParallaxY = layerData.parallaxy
    this.position.set(layerData.offsetx, layerData.offsety)
    if (layerData.tintcolor) {
      this.tint = parseTintColor(layerData.tintcolor)
    }

    if (layerData.infinite && layerData.chunks) {
      this._buildChunks(layerData.chunks, tilesets, ctx)
    } else {
      this._buildTiles(
        layerData.tiles,
        layerData.width,
        Math.floor(layerData.tiles.length / (layerData.width || 1)),
        0,
        0,
        tilesets,
        ctx
      )
    }
  }

  private _buildChunks(
    chunks: ResolvedChunk[],
    tilesets: TileSetRenderer[],
    ctx: MapContext
  ): void {
    for (const chunk of chunks) {
      this._buildTiles(chunk.tiles, chunk.width, chunk.height, chunk.x, chunk.y, tilesets, ctx)
    }
  }

  private _buildTiles(
    tiles: (ResolvedTile | null)[],
    layerWidth: number,
    layerHeight: number,
    originCol: number,
    originRow: number,
    tilesets: TileSetRenderer[],
    ctx: MapContext
  ): void {
    const order = ctx.renderorder
    const rightToLeft = order === 'left-down' || order === 'left-up'
    const bottomToTop = order === 'right-up' || order === 'left-up'

    const rowStart = bottomToTop ? layerHeight - 1 : 0
    const rowEnd = bottomToTop ? -1 : layerHeight
    const rowStep = bottomToTop ? -1 : 1

    const colStart = rightToLeft ? layerWidth - 1 : 0
    const colEnd = rightToLeft ? -1 : layerWidth
    const colStep = rightToLeft ? -1 : 1

    const tileH = ctx.tileheight

    for (let row = rowStart; row !== rowEnd; row += rowStep) {
      const rowOffset = row * layerWidth
      for (let col = colStart; col !== colEnd; col += colStep) {
        const tile = tiles[rowOffset + col]
        if (!tile) continue

        const tsRenderer = tilesets[tile.tilesetIndex]
        if (!tsRenderer) continue

        const pos = tileToPixel(originCol + col, originRow + row, ctx)
        // Read x/y immediately — pos is a reusable object overwritten on next call.
        const px = pos.x
        const py = pos.y
        const animFrames = tsRenderer.getAnimationFrames(tile.localId)

        const offset = tsRenderer.tileset.tileoffset

        if (animFrames && animFrames.length > 1) {
          const sprite = this._createAnimatedTile(tsRenderer, animFrames, tile, px, py, ctx)
          if (sprite) {
            sprite.position.x += offset.x
            sprite.position.y += offset.y
            this.addChild(sprite)
          }
        } else {
          const texture = tsRenderer.getTexture(tile.localId)
          if (!texture) continue

          const gifSource = tsRenderer.getGifSource(tile.localId)
          const renderW = tsRenderer.getRenderWidth(tile.localId, ctx)
          const renderH = tsRenderer.getRenderHeight(tile.localId, ctx)

          let sprite: Sprite
          if (gifSource) {
            sprite = new GifSprite({ source: gifSource })
          } else {
            sprite = new Sprite(texture)
          }
          const padding = getTileSpritePadding(renderW, renderH, ctx)
          sprite.width = renderW + padding
          sprite.height = renderH + padding
          sprite.position.set(px + offset.x, py + offset.y + tileH - renderH)
          applyFlip(sprite, tile, renderW)
          this.addChild(sprite)
        }
      }
    }
  }

  private _createAnimatedTile(
    tsRenderer: TileSetRenderer,
    frames: TiledFrame[],
    tile: ResolvedTile,
    x: number,
    y: number,
    ctx: MapContext
  ): AnimatedSprite | null {
    const textures: { texture: Texture; time: number }[] = []

    for (const frame of frames) {
      const tex = tsRenderer.getTexture(frame.tileid)
      if (!tex) return null
      textures.push({ texture: tex, time: frame.duration })
    }

    const sprite = new AnimatedSprite(textures)
    const renderW = tsRenderer.getRenderWidth(tile.localId, ctx)
    const renderH = tsRenderer.getRenderHeight(tile.localId, ctx)
    const padding = getTileSpritePadding(renderW, renderH, ctx)
    sprite.width = renderW + padding
    sprite.height = renderH + padding
    sprite.position.set(x, y + ctx.tileheight - renderH)
    sprite.play()
    applyFlip(sprite, tile, renderW)
    return sprite
  }
}

function getTileSpritePadding(renderW: number, renderH: number, ctx: MapContext): number {
  if (ctx.orientation !== 'orthogonal') return 0
  if (renderW !== ctx.tilewidth || renderH !== ctx.tileheight) return 0
  return ctx.tileSpritePadding ?? 0
}

function applyFlip(sprite: Sprite, tile: ResolvedTile, tileWidth: number): void {
  if (tile.diagonalFlip) {
    sprite.rotation = Math.PI / 2
    sprite.scale.x = tile.horizontalFlip ? -1 : 1
    sprite.scale.y = tile.verticalFlip ? -1 : 1
    sprite.anchor.set(0, 1)
    sprite.position.x += tileWidth
  } else {
    if (tile.horizontalFlip) {
      sprite.scale.x = -1
      sprite.anchor.x = 1
    }
    if (tile.verticalFlip) {
      sprite.scale.y = -1
      sprite.anchor.y = 1
    }
  }
}
