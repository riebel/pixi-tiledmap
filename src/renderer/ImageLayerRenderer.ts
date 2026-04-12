import { Container, Sprite, type Texture, TilingSprite } from 'pixi.js'
import type { ResolvedImageLayer } from '../types'
import { parseTintColor } from './parseColor.js'

export class ImageLayerRenderer extends Container {
  readonly layerData: ResolvedImageLayer
  readonly layerBaseOffsetX: number
  readonly layerBaseOffsetY: number
  readonly layerParallaxX: number
  readonly layerParallaxY: number

  constructor(layerData: ResolvedImageLayer, texture: Texture | null) {
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

    if (texture) {
      this._buildImage(texture)
    }
  }

  private _buildImage(texture: Texture): void {
    const { repeatx, repeaty } = this.layerData

    if (repeatx || repeaty) {
      const tiling = new TilingSprite({
        texture,
        width: repeatx ? texture.width * 10 : texture.width,
        height: repeaty ? texture.height * 10 : texture.height
      })
      this.addChild(tiling)
    } else {
      const sprite = new Sprite(texture)
      this.addChild(sprite)
    }
  }
}
