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

  // Tiled writes empty or zero values for fields the instance did not set, so
  // only a truthy instance value overrides the template.
  for (const key of INSTANCE_OVERRIDES) copyIfSet(base, obj, key)

  // An instance gid is already in map space; only a template gid needs remapping.
  if (obj.gid !== undefined) base.gid = obj.gid
  else if (base.gid !== undefined) base.gid = remapTemplateGid(base.gid, template, tilesets)

  return base
}

const INSTANCE_OVERRIDES = [
  'name',
  'type',
  'width',
  'height',
  'properties',
  'text',
  'polygon',
  'polyline',
  'ellipse',
  'point'
] as const satisfies readonly (keyof TiledObject)[]

function copyIfSet<K extends keyof TiledObject>(
  target: TiledObject,
  source: TiledObject,
  key: K
): void {
  if (source[key]) target[key] = source[key]
}

/**
 * The template's gid is relative to the template's own tileset firstgid. When
 * that tileset is an external ref the map also uses (matched by source), the
 * gid is translated into the map's firstgid space; otherwise it is kept as is.
 */
function remapTemplateGid(
  gid: number,
  template: TiledObjectTemplate,
  tilesets: ResolvedTileset[]
): number {
  const source = template.tileset?.source
  if (!source) return gid

  const mapTileset = tilesets.find((t) => t.source === source)
  if (!mapTileset) return gid

  const localId = (gid & GID_MASK) - (template.tileset?.firstgid ?? 1)
  if (localId < 0) return gid
  return (mapTileset.firstgid + localId) | (gid & ~GID_MASK)
}
