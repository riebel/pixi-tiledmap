import { Ticker } from 'pixi.js'

/**
 * A tile visual that advances its own animation from a ticker: PixiJS'
 * `AnimatedSprite` and `GifSprite` both have this shape.
 */
export interface TickerDrivenSprite {
  update(ticker: Ticker): void
  /** Whether the sprite is connected to `Ticker.shared` itself. */
  autoUpdate: boolean
  destroyed: boolean
}

export function isTickerDriven(child: unknown): child is TickerDrivenSprite {
  const candidate = child as Partial<TickerDrivenSprite> | null
  return typeof candidate?.update === 'function' && typeof candidate.autoUpdate === 'boolean'
}

/**
 * Advances every animated tile visual of one layer from a single
 * `Ticker.shared` listener.
 *
 * PixiJS' own `autoUpdate` adds one listener per sprite, which costs far more
 * than the animation itself once a layer holds thousands of animated tiles:
 * connecting 4096 of them takes longer than creating them. Tile visuals are
 * therefore created with `autoUpdate` off and driven from here.
 */
export class TileAnimationTicker {
  private readonly _sprites: TickerDrivenSprite[] = []
  private _listening = false

  /** Drives `sprite` until the next `clear()`. */
  track(sprite: TickerDrivenSprite): void {
    this._sprites.push(sprite)
    if (this._listening) return
    Ticker.shared.add(this._update, this)
    this._listening = true
  }

  /** Drops every tracked sprite and the ticker listener with them. */
  clear(): void {
    this._sprites.length = 0
    if (!this._listening) return
    Ticker.shared.remove(this._update, this)
    this._listening = false
  }

  private _update(ticker: Ticker): void {
    const sprites = this._sprites
    for (let i = 0; i < sprites.length; i++) {
      const sprite = sprites[i]!
      // A sprite the caller reconnected to the shared ticker, or destroyed
      // behind our back, must not be updated from here as well.
      if (!sprite.autoUpdate && !sprite.destroyed) sprite.update(ticker)
    }
  }
}
