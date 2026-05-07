import type { ResolvedTileset, TiledObject, TiledObjectTemplate } from '../types'
import { GID_MASK } from '../types'

/**
 * Merges a template into an object instance. The template provides default
 * field values; the instance's own fields win. After merging, any GID that
 * originated from the template is remapped from the template's firstgid space
 * into the map's firstgid space so it points at the correct tile.
 */
export function mergeTemplate(
  obj: TiledObject,
  template: TiledObjectTemplate,
  tilesets: ResolvedTileset[]
): TiledObject {
  const base: TiledObject = {
    ...template.object,
    id: obj.id,
    x: obj.x,
    y: obj.y,
    rotation: obj.rotation,
    visible: obj.visible
  }

  // Non-optional string fields: prefer instance only when non-empty (Tiled
  // stores empty string when the instance didn't set the field).
  if (obj.name) base.name = obj.name
  if (obj.type) base.type = obj.type
  if (obj.width) base.width = obj.width
  if (obj.height) base.height = obj.height
  if (obj.properties) base.properties = obj.properties
  if (obj.text) base.text = obj.text
  const gidComesFromInstance = obj.gid !== undefined
  if (gidComesFromInstance) base.gid = obj.gid
  if (obj.polygon) base.polygon = obj.polygon
  if (obj.polyline) base.polyline = obj.polyline
  if (obj.ellipse) base.ellipse = obj.ellipse
  if (obj.point) base.point = obj.point

  // GID remapping: the template's gid is relative to the template's own
  // embedded tileset firstgid. If the template carried an external tileset
  // ref (with a source path) and the map contains the same tileset (matched
  // by source), translate the gid into the map's firstgid space.
  if (
    base.gid !== undefined &&
    !gidComesFromInstance &&
    template.tileset &&
    'source' in template.tileset &&
    template.tileset.source
  ) {
    const src = template.tileset.source
    const mapTs = tilesets.find((t) => t.source === src)
    if (mapTs) {
      const templateFirstGid = template.tileset.firstgid ?? 1
      const flipBits = base.gid & ~GID_MASK
      const localId = (base.gid & GID_MASK) - templateFirstGid
      if (localId >= 0) {
        base.gid = (mapTs.firstgid + localId) | flipBits
      }
    }
  }

  return base
}
