/**
 * @vitest-environment jsdom
 */
import { CanvasTextGenerator, CanvasTextMetrics, Text, TextStyle } from 'pixi.js'
import { describe, expect, it, vi } from 'vitest'
import { ObjectLayerRenderer } from '../../src/renderer/ObjectLayerRenderer.js'
import { disableKerning } from '../../src/renderer/textKerning.js'
import { makeResolvedObjectLayer } from '../helpers/resolved.js'

type Internals = {
  _renderTextToCanvas: (...args: unknown[]) => void
}

describe('disableKerning', () => {
  it('turns canvas kerning off while PixiJS measures and draws a marked style only', () => {
    const measureContext = { fontKerning: 'auto' }
    const drawContext = { fontKerning: 'auto' }
    const seen: string[] = []
    vi.spyOn(CanvasTextMetrics, '_context', 'get').mockReturnValue(
      measureContext as unknown as CanvasRenderingContext2D
    )
    vi.spyOn(CanvasTextMetrics, 'measureText').mockImplementation(() => {
      seen.push(`measure:${measureContext.fontKerning}`)
      return {} as CanvasTextMetrics
    })
    const generator = CanvasTextGenerator as unknown as Internals
    vi.spyOn(generator, '_renderTextToCanvas').mockImplementation(() => {
      seen.push(`draw:${drawContext.fontKerning}`)
    })

    const unkerned = new TextStyle()
    const kerned = new TextStyle()
    disableKerning(unkerned)

    for (const style of [unkerned, kerned]) {
      CanvasTextMetrics.measureText('AV', style)
      generator._renderTextToCanvas(style, 0, 1, { context: drawContext }, {})
    }

    expect(seen).toEqual(['measure:none', 'draw:none', 'measure:auto', 'draw:auto'])
    expect(measureContext.fontKerning).toBe('auto')
    expect(drawContext.fontKerning).toBe('auto')
    // A separate measurement cache entry, invisible on screen.
    expect(unkerned.styleKey).not.toBe(kerned.styleKey)
    expect(unkerned.letterSpacing).toBeLessThan(0.01)
  })

  it('is applied to Tiled text objects with kerning off', () => {
    const layer = makeResolvedObjectLayer({
      objects: [
        {
          id: 1,
          name: '',
          type: '',
          x: 0,
          y: 0,
          width: 50,
          height: 20,
          rotation: 0,
          visible: true,
          text: { text: 'AV', kerning: false }
        }
      ]
    })
    const node = new ObjectLayerRenderer(layer, [], { clipText: false }).children[0] as Text
    expect(node).toBeInstanceOf(Text)
    expect(node.style.letterSpacing).toBeGreaterThan(0)
  })
})
