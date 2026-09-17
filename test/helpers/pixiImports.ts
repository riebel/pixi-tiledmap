import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

/** Named value bindings imported from each `pixi.js` specifier, with the files importing them. */
export type PixiValueImports = Map<string, Map<string, string[]>>

const pixiImportPattern =
  /\b(?:import|export)\s+(type\s+)?([^;'"]*?)\s*\bfrom\s*['"](pixi\.js(?:\/[\w-]+)?)['"]/g

/**
 * Collects the value (non-`type`) bindings that `.ts`/`.mjs` files under `dir`
 * import or re-export from `pixi.js` and its subpaths. A default binding is
 * recorded as `default` and a namespace or `export *` as `*`, so callers see it
 * rather than silently missing names. Side-effect and dynamic imports
 * bind no names and are skipped.
 */
export function collectPixiValueImports(dir: string, extension: '.ts' | '.mjs'): PixiValueImports {
  const imports: PixiValueImports = new Map()
  for (const file of listFiles(dir, extension)) {
    const source = readFileSync(file, 'utf8')
    const name = relative(dir, file).replaceAll('\\', '/')
    for (const match of source.matchAll(pixiImportPattern)) {
      const [, typeOnly, clause, specifier] = match
      if (typeOnly) continue
      for (const binding of parseClause(clause)) {
        const names = imports.get(specifier) ?? new Map<string, string[]>()
        imports.set(specifier, names)
        const files = names.get(binding) ?? []
        if (!files.includes(name)) files.push(name)
        names.set(binding, files)
      }
    }
  }
  return imports
}

function parseClause(clause: string): string[] {
  const [head, body = ''] = clause.split('{')
  return [...headBindings(head), ...namedBindings(body)]
}

function headBindings(head: string): string[] {
  const binding = head.replace(/,\s*$/, '').trim()
  if (binding === '') return []
  return [binding.startsWith('*') ? '*' : 'default']
}

function namedBindings(body: string): string[] {
  return body
    .replace('}', '')
    .split(',')
    .map((specifier) => specifier.trim())
    .filter((specifier) => specifier !== '' && !specifier.startsWith('type '))
    .map((specifier) => specifier.split(/\s+as\s+/)[0])
}

function listFiles(dir: string, extension: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(extension))
    .map((entry) => join(entry.parentPath, entry.name))
    .sort()
}
