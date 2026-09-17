import type {
  TiledClassValue,
  TiledListItem,
  TiledProperty,
  TiledPropertyType,
  TiledPropertyValue
} from '../types'
import { child, children, str } from './xmlHelpers.js'

export function parseProperties(el: Element): TiledProperty[] | undefined {
  const propsEl = child(el, 'properties')
  if (!propsEl) return undefined

  const props: TiledProperty[] = []
  for (const pEl of children(propsEl, 'property')) {
    props.push({ name: str(pEl, 'name'), ...parseTypedValue(pEl) })
  }
  return props.length > 0 ? props : undefined
}

/**
 * Reads a `<property>` or list `<item>` element into the shape Tiled writes to
 * JSON, so a TMX map and its TMJ export carry identical values.
 */
function parseTypedValue(el: Element): TiledListItem {
  const type = str(el, 'type', 'string') as TiledPropertyType
  const propertytype = el.getAttribute('propertytype') ?? undefined
  return { type, propertytype, value: parseValue(el, type) }
}

function parseValue(el: Element, type: TiledPropertyType): TiledPropertyValue {
  switch (type) {
    case 'class':
      return parseClassMembers(el)
    case 'list':
      return children(el, 'item').map(parseTypedValue)
    default:
      break
  }

  // Tiled writes multi-line strings as element text instead of an attribute.
  const raw = el.hasAttribute('value') ? str(el, 'value') : (el.textContent ?? '')
  switch (type) {
    case 'int':
    case 'object':
      return parseInt(raw, 10)
    case 'float':
      return parseFloat(raw)
    case 'bool':
      return raw === 'true'
    default:
      return raw
  }
}

/** Class members carry their own types in TMX; JSON keeps only their values. */
function parseClassMembers(el: Element): TiledClassValue {
  const members: TiledClassValue = {}
  const propsEl = child(el, 'properties')
  if (!propsEl) return members
  for (const memberEl of children(propsEl, 'property')) {
    members[str(memberEl, 'name')] = parseTypedValue(memberEl).value
  }
  return members
}
