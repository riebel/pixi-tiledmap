/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest'
import { loadMapBlendModes, usesAdvancedBlendModes } from '../../src/renderer/blendModes.js'
import { TiledMap } from '../../src/renderer/TiledMap.js'
import {
  makeResolvedGroupLayer,
  makeResolvedMap,
  makeResolvedTileLayer
} from '../helpers/resolved.js'

describe('advanced blend modes', () => {
  const plain = makeResolvedMap({
    layers: [makeResolvedTileLayer({ mode: 'multiply' }), makeResolvedTileLayer()]
  })
  const advanced = makeResolvedMap({
    layers: [
      makeResolvedGroupLayer({ layers: [makeResolvedTileLayer({ name: 'glow', mode: 'overlay' })] })
    ]
  })

  it('finds advanced modes anywhere in the layer tree', () => {
    expect(usesAdvancedBlendModes(plain)).toBe(false)
    expect(usesAdvancedBlendModes(advanced)).toBe(true)
  })

  it('loads the PixiJS extension once, and only for maps that need it', async () => {
    await expect(loadMapBlendModes(plain)).resolves.toBeUndefined()
    const first = loadMapBlendModes(advanced)
    expect(loadMapBlendModes(advanced)).toBe(first)
    await expect(first).resolves.toBeUndefined()
  })

  it('renders a layer with its advanced mode and warns about nothing', async () => {
    const warn = vi.spyOn(console, 'warn')
    const map = new TiledMap(advanced)
    await loadMapBlendModes(advanced)
    expect(map.getLayer('glow')!.blendMode).toBe('overlay')
    expect(warn).not.toHaveBeenCalled()
  })
})
