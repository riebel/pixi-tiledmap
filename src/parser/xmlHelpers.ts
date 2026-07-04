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

// `Element.children` is not implemented by every DOM backend Pixi's DOMAdapter
// may use (notably `@xmldom/xmldom` in web workers / Node). Iterate `childNodes`
// and filter to element nodes instead, which is universally supported.
const ELEMENT_NODE = 1

function isElementNode(node: ChildNode): node is Element {
  return node.nodeType === ELEMENT_NODE
}

export function elementChildren(el: Element): Element[] {
  const result: Element[] = []
  const nodes = el.childNodes
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!
    if (isElementNode(node)) result.push(node)
  }
  return result
}

export function children(el: Element, tag: string): Element[] {
  const result: Element[] = []
  const nodes = el.childNodes
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!
    if (isElementNode(node) && node.tagName === tag) result.push(node)
  }
  return result
}

export function child(el: Element, tag: string): Element | null {
  const nodes = el.childNodes
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!
    if (isElementNode(node) && node.tagName === tag) return node
  }
  return null
}
