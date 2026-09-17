import { walkLayers } from '../mapLookup.js'
import type { ResolvedMap, TiledBlendMode } from '../types'

/** Blend modes PixiJS renders without its advanced blend modes entry point. */
const BUILT_IN_BLEND_MODES: ReadonlySet<TiledBlendMode> = new Set([
  'normal',
  'add',
  'multiply',
  'screen'
])

let advancedBlendModes: Promise<void> | null = null

/** Whether any layer of the map uses a blend mode PixiJS only has as an extension. */
export function usesAdvancedBlendModes(map: Pick<ResolvedMap, 'layers'>): boolean {
  for (const layer of walkLayers(map)) {
    if (layer.mode && !BUILT_IN_BLEND_MODES.has(layer.mode)) return true
  }
  return false
}

/**
 * Loads PixiJS' advanced blend modes (`overlay`, `darken`, `color-dodge`, ...)
 * when the map uses any, so its layers render with their Tiled blend mode.
 * Resolves at once for maps that do not need them.
 *
 * The asset loader awaits this before it builds a map. When constructing a
 * `TiledMap` yourself, await it first; `TiledMap` otherwise starts the load
 * itself, and frames rendered before it finishes use normal blending.
 */
export function loadMapBlendModes(map: Pick<ResolvedMap, 'layers'>): Promise<void> {
  if (!usesAdvancedBlendModes(map)) return Promise.resolve()
  advancedBlendModes ??= import('pixi.js/advanced-blend-modes').then(
    () => undefined,
    (error: unknown) => {
      advancedBlendModes = null
      throw error
    }
  )
  return advancedBlendModes
}
