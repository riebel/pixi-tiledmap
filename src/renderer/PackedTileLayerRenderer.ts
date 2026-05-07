import { Container, Mesh, MeshGeometry, Texture, type TextureSource } from 'pixi.js'
import type { MapContext, ResolvedTile } from '../types'
import type { TileSetRenderer } from './TileSetRenderer.js'
import { createTileSprite } from './tileSpriteFactory.js'

const MAX_TILES_PER_MESH = 2_000

interface PackedTileBatch {
  texture: Texture
  positions: Float32Array
  uvs: Float32Array
  indices: Uint16Array
  positionCursor: number
  uvCursor: number
  indexCursor: number
  vertexCount: number
  tileCapacity: number
}

export class PackedTileLayerRenderer extends Container {
  private readonly _batches = new Map<TextureSource, PackedTileBatch[]>()
  private readonly _initialTileCapacity: number

  constructor(initialTileCapacity = 256) {
    super()
    this._initialTileCapacity = Math.max(1, Math.min(initialTileCapacity, MAX_TILES_PER_MESH))
  }

  addTile(
    tile: ResolvedTile,
    tsRenderer: TileSetRenderer,
    x: number,
    y: number,
    ctx: MapContext
  ): void {
    if (this._needsSpriteTile(tile, tsRenderer)) {
      const sprite = createTileSprite(tile, tsRenderer, x, y, ctx)
      if (sprite) this.addChild(sprite)
      return
    }

    const texture = tsRenderer.getTexture(tile.localId)
    if (!texture) return

    const renderW = tsRenderer.getRenderWidth(tile.localId, ctx)
    const renderH = tsRenderer.getRenderHeight(tile.localId, ctx)
    const padding = getTileMeshPadding(renderW, renderH, ctx)
    const offset = tsRenderer.tileset.tileoffset
    const left = x + offset.x
    const top = y + offset.y + ctx.tileheight - renderH
    const right = left + renderW + padding
    const bottom = top + renderH + padding
    const batch = this._getBatch(texture)
    ensureBatchCapacity(batch, batch.vertexCount / 4 + 1)
    const vertexOffset = batch.vertexCount

    batch.positions[batch.positionCursor++] = left
    batch.positions[batch.positionCursor++] = top
    batch.positions[batch.positionCursor++] = right
    batch.positions[batch.positionCursor++] = top
    batch.positions[batch.positionCursor++] = right
    batch.positions[batch.positionCursor++] = bottom
    batch.positions[batch.positionCursor++] = left
    batch.positions[batch.positionCursor++] = bottom
    pushTileUvs(batch, texture, tile)
    batch.indices[batch.indexCursor++] = vertexOffset
    batch.indices[batch.indexCursor++] = vertexOffset + 1
    batch.indices[batch.indexCursor++] = vertexOffset + 2
    batch.indices[batch.indexCursor++] = vertexOffset
    batch.indices[batch.indexCursor++] = vertexOffset + 2
    batch.indices[batch.indexCursor++] = vertexOffset + 3
    batch.vertexCount += 4
  }

  finalize(): void {
    for (const batches of this._batches.values()) {
      for (const batch of batches) {
        if (batch.vertexCount === 0) continue

        const geometry = new MeshGeometry({
          positions: batch.positions.slice(0, batch.positionCursor),
          uvs: batch.uvs.slice(0, batch.uvCursor),
          indices: batch.indices.slice(0, batch.indexCursor) as unknown as Uint32Array
        })
        geometry.batchMode = 'batch'

        this.addChild(new Mesh({ geometry, texture: batch.texture }))
      }
    }

    this._batches.clear()
  }

  private _getBatch(texture: Texture): PackedTileBatch {
    const source = texture.source
    let batches = this._batches.get(source)
    let batch = batches?.[batches.length - 1]

    if (batch && batch.vertexCount / 4 >= MAX_TILES_PER_MESH) {
      batch = undefined
    }

    if (!batch) {
      if (!batches) {
        batches = []
        this._batches.set(source, batches)
      }
      batch = {
        texture: new Texture({ source }),
        positions: new Float32Array(this._initialTileCapacity * 8),
        uvs: new Float32Array(this._initialTileCapacity * 8),
        indices: new Uint16Array(this._initialTileCapacity * 6),
        positionCursor: 0,
        uvCursor: 0,
        indexCursor: 0,
        vertexCount: 0,
        tileCapacity: this._initialTileCapacity
      }
      batches.push(batch)
    }

    return batch
  }

  private _needsSpriteTile(tile: ResolvedTile, tsRenderer: TileSetRenderer): boolean {
    const animation = tsRenderer.getAnimationFrames(tile.localId)
    if (animation && animation.length > 1) return true
    return !!tsRenderer.getGifSource(tile.localId)
  }
}

function ensureBatchCapacity(batch: PackedTileBatch, tileCount: number): void {
  if (tileCount <= batch.tileCapacity) return

  let nextCapacity = batch.tileCapacity
  while (nextCapacity < tileCount) nextCapacity *= 2

  const positions = new Float32Array(nextCapacity * 8)
  positions.set(batch.positions)
  batch.positions = positions

  const uvs = new Float32Array(nextCapacity * 8)
  uvs.set(batch.uvs)
  batch.uvs = uvs

  const indices = new Uint16Array(nextCapacity * 6)
  indices.set(batch.indices)
  batch.indices = indices

  batch.tileCapacity = nextCapacity
}

function getTileMeshPadding(renderW: number, renderH: number, ctx: MapContext): number {
  if (ctx.orientation !== 'orthogonal') return 0
  if (renderW !== ctx.tilewidth || renderH !== ctx.tileheight) return 0
  return ctx.tileSpritePadding ?? 0
}

function pushTileUvs(batch: PackedTileBatch, texture: Texture, tile: ResolvedTile): void {
  const { x0, y0, x1, y1, x2, y2, x3, y3 } = texture.uvs
  const corners: [[number, number], [number, number], [number, number], [number, number]] = [
    [x0, y0],
    [x1, y1],
    [x2, y2],
    [x3, y3]
  ]

  for (const index of getUvOrder(tile)) {
    const corner = corners[index]!
    batch.uvs[batch.uvCursor++] = corner[0]
    batch.uvs[batch.uvCursor++] = corner[1]
  }
}

function getUvOrder(tile: ResolvedTile): [number, number, number, number] {
  const h = tile.horizontalFlip
  const v = tile.verticalFlip
  const d = tile.diagonalFlip

  if (d) {
    if (h && v) return [2, 1, 0, 3]
    if (h) return [3, 0, 1, 2]
    if (v) return [1, 2, 3, 0]
    return [0, 3, 2, 1]
  }

  if (h && v) return [2, 3, 0, 1]
  if (h) return [1, 0, 3, 2]
  if (v) return [3, 2, 1, 0]
  return [0, 1, 2, 3]
}
