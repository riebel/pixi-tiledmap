import type { Container } from 'pixi.js'
import type { TiledTileLayerSelector } from '../types/index.js'
import { TileLayerRenderer } from './TileLayerRenderer.js'

export function findLayerByName(children: Iterable<Container>, name: string): Container | null {
  for (const child of children) {
    if (child.label === name) return child

    const descendant = findLayerByName(child.children, name)
    if (descendant) return descendant
  }

  return null
}

export function findTileLayerRenderer(
  children: Iterable<Container>,
  selector: TiledTileLayerSelector
): TileLayerRenderer | null {
  for (const child of children) {
    if (child instanceof TileLayerRenderer && matchesTileLayer(child, selector)) return child

    const descendant = findTileLayerRenderer(child.children, selector)
    if (descendant) return descendant
  }

  return null
}

function matchesTileLayer(layer: TileLayerRenderer, selector: TiledTileLayerSelector): boolean {
  return typeof selector === 'number'
    ? layer.layerData.id === selector
    : layer.layerData.name === selector || layer.label === selector
}
