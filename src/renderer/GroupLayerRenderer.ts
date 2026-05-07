import { Container } from 'pixi.js'
import type { ResolvedGroupLayer } from '../types'
import {
  createLayerRendererFromContext,
  type LayerTreeRendererContext
} from './layerTreeRenderer.js'
import { applyLayerState } from './renderableLayer.js'

export class GroupLayerRenderer extends Container {
  readonly layerData: ResolvedGroupLayer

  constructor(layerData: ResolvedGroupLayer, context: LayerTreeRendererContext) {
    super()

    this.layerData = layerData
    applyLayerState(this, layerData)

    for (const child of layerData.layers) {
      const renderer = createLayerRendererFromContext(child, context)
      if (renderer) this.addChild(renderer)
    }
  }
}
