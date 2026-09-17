/**
 * Deep-copies the plain JSON data Tiled files are made of: objects, arrays and
 * primitives. Nothing in a `Tiled*` shape is a `Map`, `Set`, `Date` or class
 * instance, so anything else is returned as it is rather than silently
 * half-copied.
 *
 * Used where a result must not alias the input it was built from: a map export
 * hands out a document the caller edits, and a template is merged into many
 * objects.
 */
export function cloneJson<T>(value: T): T {
  if (Array.isArray(value)) return value.map(cloneJson) as T
  if (value === null || typeof value !== 'object') return value

  const source = value as Record<string, unknown>
  const copy: Record<string, unknown> = {}
  for (const key of Object.keys(source)) copy[key] = cloneJson(source[key])
  return copy as T
}
