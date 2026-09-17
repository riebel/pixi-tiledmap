import { CanvasTextGenerator, CanvasTextMetrics, type TextStyle } from 'pixi.js'

/**
 * PixiJS has no kerning option, but the 2D canvas does: `fontKerning`. Tiled
 * text objects can turn kerning off, so the styles of such texts are marked
 * here, and PixiJS' canvas text measuring and drawing switch kerning off
 * while they handle a marked style.
 *
 * The hooks wrap two PixiJS text internals and are installed only once a text
 * actually asks for it. If a PixiJS version lacks either internal, that part
 * is skipped and the text keeps its kerning.
 */

/**
 * A letter spacing far too small to see. PixiJS caches text measurements by
 * style, and kerning is not part of that key, so an unkerned style needs a
 * visible difference from its kerned twin to get its own cache entry.
 */
const UNKERNED_LETTER_SPACING = 0.001

const unkernedStyles = new WeakSet<TextStyle>()
let hooksInstalled = false

interface KerningContext {
  fontKerning?: string
}

type RenderTextToCanvas = (
  style: TextStyle,
  padding: number,
  resolution: number,
  canvasAndContext: { context: KerningContext },
  measured: unknown
) => void

type MeasureText = (text: string, style: TextStyle, ...rest: unknown[]) => unknown

/** Draws and measures texts with `style` without kerning. */
export function disableKerning(style: TextStyle): void {
  unkernedStyles.add(style)
  if (style.letterSpacing === 0) style.letterSpacing = UNKERNED_LETTER_SPACING
  installKerningHooks()
}

function withoutKerning<T>(
  style: TextStyle | undefined,
  getContext: () => KerningContext | undefined,
  run: () => T
): T {
  if (!style || !unkernedStyles.has(style)) return run()
  const context = getContext()
  if (!context || !('fontKerning' in context)) return run()
  const previous = context.fontKerning
  context.fontKerning = 'none'
  try {
    return run()
  } finally {
    context.fontKerning = previous
  }
}

function installKerningHooks(): void {
  if (hooksInstalled) return
  hooksInstalled = true

  const metrics = CanvasTextMetrics as unknown as {
    measureText?: MeasureText
    readonly _context?: KerningContext
  }
  const measureText = metrics.measureText
  if (measureText) {
    metrics.measureText = function (this: unknown, text, style, ...rest) {
      return withoutKerning(
        style,
        () => metrics._context,
        () => measureText.call(this, text, style, ...rest)
      )
    }
  }

  const generator = CanvasTextGenerator as unknown as { _renderTextToCanvas?: RenderTextToCanvas }
  const render = generator._renderTextToCanvas
  if (render) {
    generator._renderTextToCanvas = function (this: unknown, style, ...rest) {
      withoutKerning(
        style,
        () => rest[2].context,
        () => render.call(this, style, ...rest)
      )
    }
  }
}
