import { Container } from 'pixi.js'
import type { ResolvedGroupLayer } from '../types'
import {
  createLayerRendererWithGroupFactory,
  type LayerTreeRendererContext
} from './layerRendererFactory.js'
import { applyLayerState } from './renderableLayer.js'

export class GroupLayerRenderer extends Container {
  readonly layerData: ResolvedGroupLayer

  constructor(layerData: ResolvedGroupLayer, context: LayerTreeRendererContext) {
    super()

    this.layerData = layerData
    applyLayerState(this, layerData)

    for (const child of layerData.layers) {
      const renderer = createLayerRendererWithGroupFactory(child, context, createGroupLayerRenderer)
      if (renderer) this.addChild(renderer)
    }
  }
}

function createGroupLayerRenderer(
  layer: ResolvedGroupLayer,
  context: LayerTreeRendererContext
): GroupLayerRenderer {
  return new GroupLayerRenderer(layer, context)
}
