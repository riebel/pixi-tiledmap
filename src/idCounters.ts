import { type LayerHolder, walkLayers } from './mapLookup.js'

/** One past the highest layer id anywhere in the tree. */
function nextFreeLayerId(holder: LayerHolder): number {
  let max = 0
  for (const layer of walkLayers(holder)) {
    if (layer.id > max) max = layer.id
  }
  return max + 1
}

/** One past the highest object id anywhere in the tree. */
function nextFreeObjectId(holder: LayerHolder): number {
  let max = 0
  for (const layer of walkLayers(holder)) {
    if (layer.type !== 'objectgroup') continue
    for (const object of layer.objects) {
      if (object.id > max) max = object.id
    }
  }
  return max + 1
}

/**
 * Tiled's id counters for a map: the stored values, raised to cover every id
 * in use. Tiled never hands out an id twice, so a stored counter above the
 * highest id - left there by deleted layers or objects - is kept.
 */
export function resolveIdCounters(
  holder: LayerHolder,
  stored: { nextlayerid?: number; nextobjectid?: number }
): { nextlayerid: number; nextobjectid: number } {
  return {
    nextlayerid: Math.max(stored.nextlayerid ?? 0, nextFreeLayerId(holder)),
    nextobjectid: Math.max(stored.nextobjectid ?? 0, nextFreeObjectId(holder))
  }
}
