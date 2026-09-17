import type { ResolvedTileset, TiledObject, TiledObjectTemplate, TiledProperty } from '../types'
import { GID_MASK } from '../types'
import { dirname, joinRelativePath, normalizeRelativePath } from './relativePath.js'

/**
 * Merges a template into an object instance, the way Tiled's
 * `MapObject::syncWithTemplate` does.
 *
 * Tiled writes a field on an instance only when the instance changed it, so a
 * field the instance carries wins - even an empty name or a zero rotation - and
 * every other field comes from the template. The shape is one unit: an
 * instance that sets any shape replaces the template's shape entirely. Custom
 * properties merge by name, the instance winning.
 *
 * After merging, a GID that originated from the template is remapped from the
 * template's firstgid space into the map's firstgid space.
 *
 * `templatePath` is the key the instance references the template by; it lets a
 * template tileset source that is still relative to the template file match the
 * map's tileset.
 */
export function mergeTemplate(
  obj: TiledObject,
  template: TiledObjectTemplate,
  tilesets: ResolvedTileset[],
  templatePath?: string
): TiledObject {
  const base: TiledObject = { ...template.object, id: obj.id, x: obj.x, y: obj.y }

  for (const key of INSTANCE_OVERRIDES) copyIfPresent(base, obj, key)
  // Tiled resolves an empty class to the template's class.
  if (obj.type) base.type = obj.type

  if (SHAPE_KEYS.some((key) => obj[key] !== undefined)) {
    for (const key of SHAPE_KEYS) {
      if (obj[key] === undefined) delete base[key]
      else copyIfPresent(base, obj, key)
    }
  }

  const properties = mergeProperties(template.object.properties, obj.properties)
  if (properties) base.properties = properties
  else delete base.properties

  // An instance gid is already in map space; only a template gid needs remapping.
  if (obj.gid !== undefined) base.gid = obj.gid
  else if (base.gid !== undefined) {
    base.gid = remapTemplateGid(base.gid, template, tilesets, templatePath)
  }

  return base
}

const INSTANCE_OVERRIDES = [
  'name',
  'width',
  'height',
  'rotation',
  'opacity',
  'visible'
] as const satisfies readonly (keyof TiledObject)[]

const SHAPE_KEYS = [
  'ellipse',
  'point',
  'capsule',
  'polygon',
  'polyline',
  'text'
] as const satisfies readonly (keyof TiledObject)[]

function copyIfPresent<K extends keyof TiledObject>(
  target: TiledObject,
  source: TiledObject,
  key: K
): void {
  if (source[key] !== undefined) target[key] = source[key]
}

function mergeProperties(
  base: TiledProperty[] | undefined,
  overrides: TiledProperty[] | undefined
): TiledProperty[] | undefined {
  if (!base?.length) return overrides
  if (!overrides?.length) return base
  const merged = new Map(base.map((property) => [property.name, property]))
  for (const property of overrides) merged.set(property.name, property)
  return [...merged.values()]
}

/**
 * The template's gid is relative to the template's own tileset firstgid. When
 * that tileset is an external ref the map also uses (matched by source), the
 * gid is translated into the map's firstgid space; otherwise it is kept as is.
 */
function remapTemplateGid(
  gid: number,
  template: TiledObjectTemplate,
  tilesets: ResolvedTileset[],
  templatePath: string | undefined
): number {
  const source = template.tileset?.source
  if (!source) return gid

  const mapTileset = findTilesetBySource(tilesets, source, templatePath)
  if (!mapTileset) return gid

  const localId = (gid & GID_MASK) - (template.tileset?.firstgid ?? 1)
  if (localId < 0) return gid
  return (mapTileset.firstgid + localId) | (gid & ~GID_MASK)
}

/**
 * The asset loader rebases a template's tileset source onto the map directory;
 * a caller of `parseMap` may pass it still relative to the template file. Try
 * the source as given first, then resolved against the template's directory.
 * Both sides are normalized, so `./a.tsx` and `a.tsx` name the same file.
 */
function findTilesetBySource(
  tilesets: ResolvedTileset[],
  source: string,
  templatePath: string | undefined
): ResolvedTileset | undefined {
  const candidates = [normalizeRelativePath(source)]
  if (templatePath !== undefined) {
    candidates.push(joinRelativePath(dirname(templatePath), source))
  }
  for (const candidate of candidates) {
    const match = tilesets.find(
      (tileset) =>
        tileset.source !== undefined && normalizeRelativePath(tileset.source) === candidate
    )
    if (match) return match
  }
  return undefined
}
