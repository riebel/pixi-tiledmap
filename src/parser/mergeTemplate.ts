import type {
  ResolvedTileset,
  TiledObject,
  TiledObjectTemplate,
  TiledProperty,
  TiledTemplateInstance
} from '../types'
import { GID_MASK } from '../types'
import { cloneJson } from './cloneJson.js'
import { dirname, joinRelativePath, normalizeRelativePath } from './relativePath.js'

/**
 * Merges a template into an object instance, the way Tiled's
 * `MapObject::syncWithTemplate` does.
 *
 * Tiled writes a field on an instance only when the instance changed it, so a
 * field the instance carries wins - even a zero rotation or a hidden flag - and
 * every other field comes from the template. Name and size are the exception:
 * Tiled reads an empty name, and a size with a width or height of 0, as
 * unchanged, and takes the template's. Width and height count as one size. The
 * shape is one unit: an instance that sets any shape replaces the template's
 * shape entirely. Custom properties merge by name, the instance winning.
 *
 * After merging, a GID that originated from the template is remapped from the
 * template's firstgid space into the map's firstgid space. Nothing in the
 * result is shared with the template, so two instances of one template can be
 * edited independently.
 *
 * `templatePath` is the key the instance references the template by; it lets a
 * template tileset source that is still relative to the template file match the
 * map's tileset.
 */
export function mergeTemplate(
  obj: TiledObject | TiledTemplateInstance,
  template: TiledObjectTemplate,
  tilesets: ResolvedTileset[],
  templatePath?: string
): TiledObject {
  // Copied, not shared: every instance of a template would otherwise draw from
  // the same polygon, text and property objects, and editing one would move
  // its siblings and the template with it.
  const base: TiledObject = { ...cloneJson(template.object), id: obj.id, x: obj.x, y: obj.y }

  for (const key of INSTANCE_OVERRIDES) copyIfPresent(base, obj, key)
  // Tiled resolves an empty name and class to the template's.
  if (obj.name) base.name = obj.name
  if (obj.type) base.type = obj.type
  if (hasSize(obj)) {
    base.width = obj.width
    base.height = obj.height
  }

  if (SHAPE_KEYS.some((key) => obj[key] !== undefined)) {
    for (const key of SHAPE_KEYS) {
      if (obj[key] === undefined) delete base[key]
      else copyIfPresent(base, obj, key)
    }
  }

  // From `base`, so an instance without overrides keeps the copy rather than
  // the template's own array.
  const properties = mergeProperties(base.properties, obj.properties)
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

/** Whether the instance sets a size Tiled counts as changed: `QSizeF::isEmpty` is false. */
function hasSize(
  obj: TiledObject | TiledTemplateInstance
): obj is (TiledObject | TiledTemplateInstance) & { width: number; height: number } {
  return (obj.width ?? 0) > 0 && (obj.height ?? 0) > 0
}

function copyIfPresent<K extends (typeof INSTANCE_OVERRIDES | typeof SHAPE_KEYS)[number]>(
  target: TiledObject,
  source: TiledObject | TiledTemplateInstance,
  key: K
): void {
  const value = source[key]
  if (value !== undefined) target[key] = value as TiledObject[K]
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
