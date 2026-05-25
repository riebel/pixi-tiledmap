import { Container, Mesh, MeshGeometry, Texture, type TextureSource } from 'pixi.js'
import type { MapContext, ResolvedTile } from '../types'
import type { TileSetRenderer } from './TileSetRenderer.js'
import { createTileSprite } from './tileSpriteFactory.js'

const DEFAULT_TILES_PER_MESH = 16_000
const MAX_TILES_PER_MESH = 16_383

interface PackedTileBatch {
  texture: Texture
  alpha: number
  positions: Float32Array
  uvs: Float32Array
  handles: PackedTileRenderHandle[]
  positionCursor: number
  uvCursor: number
  vertexCount: number
  tileCapacity: number
}

const quadIndexCache = new Map<number, Uint32Array>()

export interface PackedTileRenderHandle {
  mesh: Mesh | null
  textureSource: TextureSource
  alpha: number
  x: number
  y: number
  width: number
  height: number
  uvKey?: number
  positionOffset: number
  uvOffset: number
}

export interface PackedTextureRect {
  texture: Texture
  x: number
  y: number
  width: number
  height: number
  alpha?: number
  uvOrder?: readonly [number, number, number, number]
  uvKey?: number
}

export class PackedTileLayerRenderer extends Container {
  private readonly _batches = new Map<TextureSource, Map<number, PackedTileBatch[]>>()
  private readonly _initialTileCapacity: number
  private readonly _maxTilesPerMesh: number

  constructor(initialTileCapacity = 256, maxTilesPerMesh = DEFAULT_TILES_PER_MESH) {
    super()
    this._maxTilesPerMesh = Math.max(1, Math.min(maxTilesPerMesh, MAX_TILES_PER_MESH))
    this._initialTileCapacity = Math.max(1, Math.min(initialTileCapacity, this._maxTilesPerMesh))
  }

  addTile(
    tile: ResolvedTile,
    tsRenderer: TileSetRenderer,
    x: number,
    y: number,
    ctx: MapContext
  ): PackedTileRenderHandle | null {
    if (this._needsSpriteTile(tile, tsRenderer)) {
      const sprite = createTileSprite(tile, tsRenderer, x, y, ctx)
      if (sprite) this.addChild(sprite)
      return null
    }

    const texture = tsRenderer.getTexture(tile.localId)
    if (!texture) return null

    const renderW = tsRenderer.getRenderWidth(tile.localId, ctx)
    const renderH = tsRenderer.getRenderHeight(tile.localId, ctx)
    const padding = getTileMeshPadding(renderW, renderH, ctx)
    const tileOffset = tsRenderer.tileset.tileoffset

    return this.addTextureRect({
      texture,
      x: x + tileOffset.x,
      y: y + tileOffset.y + ctx.tileheight - renderH,
      width: renderW + padding,
      height: renderH + padding,
      alpha: tile.alpha,
      uvOrder: getUvOrder(tile),
      uvKey: getTileUvKey(tile)
    })
  }

  finalize(): void {
    for (const batchesByAlpha of this._batches.values()) {
      for (const batches of batchesByAlpha.values()) {
        for (const batch of batches) {
          if (batch.vertexCount === 0) continue

          const geometry = new MeshGeometry({
            positions: batch.positions.slice(0, batch.positionCursor),
            uvs: batch.uvs.slice(0, batch.uvCursor),
            indices: getQuadIndices(batch.vertexCount / 4)
          })
          geometry.batchMode = 'batch'

          const mesh = new Mesh({ geometry, texture: batch.texture })
          mesh.alpha = batch.alpha
          for (const handle of batch.handles) {
            handle.mesh = mesh
          }
          this.addChild(mesh)
        }
      }
    }

    this._batches.clear()
  }

  updatePackedTile(
    handle: PackedTileRenderHandle,
    tile: ResolvedTile,
    tsRenderer: TileSetRenderer,
    x: number,
    y: number,
    ctx: MapContext
  ): boolean {
    if (!handle.mesh || this._needsSpriteTile(tile, tsRenderer)) return false

    const texture = tsRenderer.getTexture(tile.localId)
    if (!texture || texture.source !== handle.textureSource) return false
    if ((tile.alpha ?? 1) !== handle.alpha) return false

    const renderW = tsRenderer.getRenderWidth(tile.localId, ctx)
    const renderH = tsRenderer.getRenderHeight(tile.localId, ctx)
    const padding = getTileMeshPadding(renderW, renderH, ctx)
    const tileOffset = tsRenderer.tileset.tileoffset
    const rectX = x + tileOffset.x
    const rectY = y + tileOffset.y + ctx.tileheight - renderH
    const rectW = renderW + padding
    const rectH = renderH + padding
    const uvKey = getTileUvKey(tile)
    const geometry = handle.mesh.geometry

    if (
      rectX !== handle.x ||
      rectY !== handle.y ||
      rectW !== handle.width ||
      rectH !== handle.height
    ) {
      writeRectPositions(geometry.positions, handle.positionOffset, rectX, rectY, rectW, rectH)
      geometry.getBuffer('aPosition').update()
      handle.x = rectX
      handle.y = rectY
      handle.width = rectW
      handle.height = rectH
    }

    if (uvKey !== handle.uvKey) {
      writeTileUvs(geometry.uvs, handle.uvOffset, texture, tile)
      geometry.getBuffer('aUV').update()
      handle.uvKey = uvKey
    }
    return true
  }

  addTextureRect(rect: PackedTextureRect): PackedTileRenderHandle {
    const alpha = rect.alpha ?? 1
    const batch = this._getBatch(rect.texture, alpha)
    ensureBatchCapacity(batch, batch.vertexCount / 4 + 1)
    const handle: PackedTileRenderHandle = {
      mesh: null,
      textureSource: rect.texture.source,
      alpha,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      uvKey: rect.uvKey,
      positionOffset: batch.positionCursor,
      uvOffset: batch.uvCursor
    }

    writeRectPositions(
      batch.positions,
      batch.positionCursor,
      rect.x,
      rect.y,
      rect.width,
      rect.height
    )
    batch.positionCursor += 8
    writeTextureUvs(batch.uvs, batch.uvCursor, rect.texture, rect.uvOrder)
    batch.uvCursor += 8
    batch.handles.push(handle)
    batch.vertexCount += 4

    return handle
  }

  clearPackedTile(handle: PackedTileRenderHandle): boolean {
    if (!handle.mesh) return false

    const geometry = handle.mesh.geometry
    geometry.positions.fill(0, handle.positionOffset, handle.positionOffset + 8)
    geometry.uvs.fill(0, handle.uvOffset, handle.uvOffset + 8)
    geometry.getBuffer('aPosition').update()
    geometry.getBuffer('aUV').update()
    return true
  }

  private _getBatch(texture: Texture, alpha: number): PackedTileBatch {
    const source = texture.source
    let batchesByAlpha = this._batches.get(source)
    if (!batchesByAlpha) {
      batchesByAlpha = new Map()
      this._batches.set(source, batchesByAlpha)
    }

    let batches = batchesByAlpha.get(alpha)
    let batch = batches?.[batches.length - 1]

    if (batch && batch.vertexCount / 4 >= this._maxTilesPerMesh) {
      batch = undefined
    }

    if (!batch) {
      if (!batches) {
        batches = []
        batchesByAlpha.set(alpha, batches)
      }
      batch = {
        texture: new Texture({ source }),
        alpha,
        positions: new Float32Array(this._initialTileCapacity * 8),
        uvs: new Float32Array(this._initialTileCapacity * 8),
        handles: [],
        positionCursor: 0,
        uvCursor: 0,
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

function writeRectPositions(
  positions: Float32Array,
  offset: number,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  const right = x + width
  const bottom = y + height

  positions[offset] = x
  positions[offset + 1] = y
  positions[offset + 2] = right
  positions[offset + 3] = y
  positions[offset + 4] = right
  positions[offset + 5] = bottom
  positions[offset + 6] = x
  positions[offset + 7] = bottom
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

  batch.tileCapacity = nextCapacity
}

function getQuadIndices(tileCount: number): Uint32Array {
  let indices = quadIndexCache.get(tileCount)
  if (indices) return indices

  indices = new Uint32Array(tileCount * 6)
  for (let index = 0, vertex = 0; index < indices.length; index += 6, vertex += 4) {
    indices[index] = vertex
    indices[index + 1] = vertex + 1
    indices[index + 2] = vertex + 2
    indices[index + 3] = vertex
    indices[index + 4] = vertex + 2
    indices[index + 5] = vertex + 3
  }
  quadIndexCache.set(tileCount, indices)
  return indices
}

function getTileMeshPadding(renderW: number, renderH: number, ctx: MapContext): number {
  if (ctx.orientation !== 'orthogonal') return 0
  if (renderW !== ctx.tilewidth || renderH !== ctx.tileheight) return 0
  return ctx.tileSpritePadding ?? 0
}

function writeTileUvs(
  uvs: Float32Array,
  offset: number,
  texture: Texture,
  tile: ResolvedTile
): void {
  writeTextureUvs(uvs, offset, texture, getUvOrder(tile))
}

function writeTextureUvs(
  uvs: Float32Array,
  offset: number,
  texture: Texture,
  uvOrder: readonly [number, number, number, number] = [0, 1, 2, 3]
): void {
  const { x0, y0, x1, y1, x2, y2, x3, y3 } = texture.uvs
  const corners: [[number, number], [number, number], [number, number], [number, number]] = [
    [x0, y0],
    [x1, y1],
    [x2, y2],
    [x3, y3]
  ]

  for (const index of uvOrder) {
    const corner = corners[index]!
    uvs[offset++] = corner[0]
    uvs[offset++] = corner[1]
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

function getTileUvKey(tile: ResolvedTile): number {
  return (
    tile.localId * 8 +
    (tile.horizontalFlip ? 1 : 0) +
    (tile.verticalFlip ? 2 : 0) +
    (tile.diagonalFlip ? 4 : 0)
  )
}
