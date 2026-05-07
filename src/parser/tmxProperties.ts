import type { TiledProperty, TiledPropertyType } from '../types'
import { child, children, str } from './xmlHelpers.js'

export function parseProperties(el: Element): TiledProperty[] | undefined {
  const propsEl = child(el, 'properties')
  if (!propsEl) return undefined

  const props: TiledProperty[] = []
  for (const pEl of children(propsEl, 'property')) {
    const type = str(pEl, 'type', 'string') as TiledPropertyType
    let value: string | number | boolean = str(pEl, 'value', '')
    if (!pEl.hasAttribute('value')) {
      value = pEl.textContent ?? ''
    }
    if (type === 'int') value = parseInt(value as string, 10)
    else if (type === 'float') value = parseFloat(value as string)
    else if (type === 'bool') value = value === 'true'

    props.push({
      name: str(pEl, 'name'),
      type,
      propertytype: pEl.getAttribute('propertytype') ?? undefined,
      value
    })
  }
  return props.length > 0 ? props : undefined
}
