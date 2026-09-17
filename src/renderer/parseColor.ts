/**
 * Splits a Tiled color (`#AARRGGBB`, `#RRGGBB`, with or without `#`) into an
 * RGB number and an alpha from 0 to 1.
 */
export function parseColorWithAlpha(hex: string): { color: number; alpha: number } {
  const clean = hex.replace('#', '')
  if (clean.length === 8) {
    return { color: parseInt(clean.slice(2), 16), alpha: parseInt(clean.slice(0, 2), 16) / 255 }
  }
  return { color: parseInt(clean, 16), alpha: 1 }
}

/**
 * Converts a Tiled color to a CSS hex color. Tiled puts alpha first
 * (`#AARRGGBB`); CSS and PixiJS put it last (`#RRGGBBAA`).
 */
export function tiledColorToCss(hex: string): string {
  const clean = hex.replace('#', '')
  return clean.length === 8 ? `#${clean.slice(2)}${clean.slice(0, 2)}` : `#${clean}`
}

export function parseTintColor(hex: string): number {
  const clean = hex.replace('#', '')
  // #AARRGGBB → strip alpha, use RRGGBB
  if (clean.length === 8) {
    return parseInt(clean.slice(2), 16)
  }
  // #RRGGBB
  return parseInt(clean, 16)
}
