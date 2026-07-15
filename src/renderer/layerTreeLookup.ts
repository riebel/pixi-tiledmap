import type { Container } from 'pixi.js'
import type { TiledTileLayerSelector } from '../types/index.js'
import { GroupLayerRenderer } from './GroupLayerRenderer.js'
import { TileLayerRenderer } from './TileLayerRenderer.js'

export interface TileLayerIndex {
  byId: Map<number, TileLayerRenderer>
  byName: Map<string, TileLayerRenderer>
  ambiguousIds: Set<number>
  ambiguousNames: Set<string>
}

/**
 * Indexes the tile layers of a rendered layer tree.
 *
 * Only group layers can contain further layers, so a layer's own render
 * children (meshes, sprites) are deliberately not walked: skipping them is what
 * keeps the index both cheap and valid across the per-layer rebuilds those
 * children go through.
 *
 * Selectors matching more than one layer are deliberately left out. First-match
 * on duplicates depends on the *current* child order, which a cached index
 * cannot track, so those lookups fall through to the live walk and keep their
 * existing semantics exactly.
 */
export function buildTileLayerIndex(children: Iterable<Container>): TileLayerIndex {
  const index: TileLayerIndex = {
    byId: new Map(),
    byName: new Map(),
    ambiguousIds: new Set(),
    ambiguousNames: new Set()
  }
  indexTileLayers(children, index)
  return index
}

/**
 * Resolves an unambiguous selector, or `null` when the caller must fall back to
 * a live walk. `root` is required because a hit is only valid while the layer is
 * still part of that tree: a layer reparented elsewhere keeps a truthy `parent`
 * but must no longer resolve through this map.
 */
export function findTileLayerInIndex(
  index: TileLayerIndex,
  selector: TiledTileLayerSelector,
  root: Container
): TileLayerRenderer | null {
  const found = typeof selector === 'number' ? index.byId.get(selector) : index.byName.get(selector)

  if (!found || found.destroyed) return null
  return isDescendantOf(found, root) ? found : null
}

function isDescendantOf(layer: Container, root: Container): boolean {
  for (let node: Container | null = layer.parent; node; node = node.parent) {
    if (node === root) return true
  }
  return false
}

function indexTileLayers(children: Iterable<Container>, index: TileLayerIndex): void {
  for (const child of children) {
    if (child instanceof TileLayerRenderer) {
      registerId(index, child.layerData.id, child)
      registerName(index, child.layerData.name, child)
      registerName(index, child.label, child)
      continue
    }

    if (child instanceof GroupLayerRenderer) indexTileLayers(child.children, index)
  }
}

function registerId(index: TileLayerIndex, id: number, layer: TileLayerRenderer): void {
  if (index.ambiguousIds.has(id)) return
  if (index.byId.has(id)) {
    index.byId.delete(id)
    index.ambiguousIds.add(id)
    return
  }
  index.byId.set(id, layer)
}

function registerName(
  index: TileLayerIndex,
  name: string | null | undefined,
  layer: TileLayerRenderer
): void {
  if (!name || index.ambiguousNames.has(name)) return
  if (index.byName.has(name)) {
    // A layer registering under both `layerData.name` and `label` is not a
    // duplicate; only a second layer makes the selector ambiguous.
    if (index.byName.get(name) === layer) return
    index.byName.delete(name)
    index.ambiguousNames.add(name)
    return
  }
  index.byName.set(name, layer)
}

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
