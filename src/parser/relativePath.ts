// Pixi-free path helpers for Tiled's file references, so the parser can compare
// them without pulling in `pixi.js`.

/** An absolute path, or a URL with a scheme (`https:`, `data:`, `blob:`, `C:`). */
function isRootedPath(path: string): boolean {
  return path.startsWith('/') || /^[a-z][a-z\d+.-]*:/i.test(path)
}

/** The directory part of a `/`-separated path; `''` for a bare file name. */
export function dirname(path: string): string {
  const posix = path.replace(/\\/g, '/')
  const slash = posix.lastIndexOf('/')
  return slash < 0 ? '' : posix.slice(0, slash)
}

/**
 * Collapses `.` and `..` segments of a relative path. A `..` that climbs above
 * the start is kept, so `../tilesets/a.tsx` stays pointing at a sibling
 * directory. Rooted paths are only converted to `/` separators.
 */
export function normalizeRelativePath(path: string): string {
  const posix = path.replace(/\\/g, '/')
  if (isRootedPath(posix)) return posix

  const segments: string[] = []
  for (const segment of posix.split('/')) {
    if (segment === '' || segment === '.') continue
    if (segment === '..' && segments.length > 0 && segments[segments.length - 1] !== '..') {
      segments.pop()
    } else {
      segments.push(segment)
    }
  }
  return segments.join('/')
}

/** Resolves `source` against the relative directory `basePath`. */
export function joinRelativePath(basePath: string, source: string): string {
  if (isRootedPath(source)) return normalizeRelativePath(source)
  return normalizeRelativePath(basePath === '' ? source : `${basePath}/${source}`)
}
