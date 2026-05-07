export function str(el: Element, name: string, fallback = ''): string {
  return el.getAttribute(name) ?? fallback
}

export function int(el: Element, name: string, fallback = 0): number {
  const value = el.getAttribute(name)
  return value != null ? parseInt(value, 10) : fallback
}

export function float(el: Element, name: string, fallback = 0): number {
  const value = el.getAttribute(name)
  return value != null ? parseFloat(value) : fallback
}

export function bool(el: Element, name: string, fallback = false): boolean {
  const value = el.getAttribute(name)
  if (value == null) return fallback
  return value === '1' || value === 'true'
}

export function optStr(el: Element, name: string): string | undefined {
  const value = el.getAttribute(name)
  return value != null ? value : undefined
}

export function optInt(el: Element, name: string): number | undefined {
  const value = el.getAttribute(name)
  return value != null ? parseInt(value, 10) : undefined
}

export function optFloat(el: Element, name: string): number | undefined {
  const value = el.getAttribute(name)
  return value != null ? parseFloat(value) : undefined
}

export function children(el: Element, tag: string): Element[] {
  const result: Element[] = []
  for (let i = 0; i < el.children.length; i++) {
    const child = el.children[i]!
    if (child.tagName === tag) result.push(child)
  }
  return result
}

export function child(el: Element, tag: string): Element | null {
  for (let i = 0; i < el.children.length; i++) {
    const current = el.children[i]!
    if (current.tagName === tag) return current
  }
  return null
}
