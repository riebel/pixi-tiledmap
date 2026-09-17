import type {
  TiledFillMode,
  TiledFrame,
  TiledGrid,
  TiledGridOrientation,
  TiledLayer,
  TiledObjectAlignment,
  TiledProperty,
  TiledPropertyValue,
  TiledTerrain,
  TiledTileDefinition,
  TiledTileOffset,
  TiledTileRenderSize,
  TiledTileset,
  TiledTilesetRef,
  TiledTransformations,
  TiledWangColor,
  TiledWangSet,
  TiledWangSetType,
  TiledWangTile
} from '../types'
import { computeTilesetColumns } from './tilesetHelpers.js'
import { parseProperties } from './tmxProperties.js'
import { bool, child, children, float, int, optFloat, optInt, optStr, str } from './xmlHelpers.js'

export interface ImageInfo {
  image?: string
  imagewidth?: number
  imageheight?: number
  transparentcolor?: string
}

export type ObjectGroupParser = (el: Element) => TiledLayer

export function parseImage(el: Element): ImageInfo {
  const imgEl = child(el, 'image')
  if (!imgEl) return {}
  return {
    image: optStr(imgEl, 'source'),
    imagewidth: optInt(imgEl, 'width'),
    imageheight: optInt(imgEl, 'height'),
    transparentcolor: optStr(imgEl, 'trans')
  }
}

export function parseTileset(
  el: Element,
  parseObjectGroup?: ObjectGroupParser
): TiledTileset | TiledTilesetRef {
  const source = optStr(el, 'source')
  if (source) {
    return {
      firstgid: int(el, 'firstgid'),
      source
    } satisfies TiledTilesetRef
  }

  const img = parseImage(el)
  const tiles = parseTileDefinitions(el, parseObjectGroup)

  const tilewidth = int(el, 'tilewidth')
  const spacing = int(el, 'spacing')
  const margin = int(el, 'margin')
  const columns = computeTilesetColumns({
    columns: int(el, 'columns'),
    imagewidth: img.imagewidth,
    tilewidth,
    margin,
    spacing
  })

  return {
    backgroundcolor: optStr(el, 'backgroundcolor'),
    class: optStr(el, 'class'),
    columns,
    fillmode: optStr(el, 'fillmode') as TiledFillMode | undefined,
    firstgid: int(el, 'firstgid'),
    grid: parseGrid(el),
    margin,
    name: str(el, 'name'),
    objectalignment: optStr(el, 'objectalignment') as TiledObjectAlignment | undefined,
    properties: parseProperties(el),
    spacing,
    terrains: parseTerrains(el),
    tilecount: int(el, 'tilecount'),
    tileheight: int(el, 'tileheight'),
    tileoffset: parseTileOffset(el),
    tilerendersize: optStr(el, 'tilerendersize') as TiledTileRenderSize | undefined,
    tiles,
    tilewidth,
    transformations: parseTransformations(el),
    // Only a standalone TSX root carries these.
    version: optStr(el, 'version'),
    tiledversion: optStr(el, 'tiledversion'),
    wangsets: parseWangSets(el),
    ...img
  } satisfies TiledTileset
}

function parseTileOffset(el: Element): TiledTileOffset | undefined {
  const to = child(el, 'tileoffset')
  if (!to) return undefined
  return { x: int(to, 'x'), y: int(to, 'y') }
}

function parseGrid(el: Element): TiledGrid | undefined {
  const g = child(el, 'grid')
  if (!g) return undefined
  return {
    orientation: str(g, 'orientation', 'orthogonal') as TiledGridOrientation,
    width: int(g, 'width'),
    height: int(g, 'height')
  }
}

function parseTransformations(el: Element): TiledTransformations | undefined {
  const t = child(el, 'transformations')
  if (!t) return undefined
  return {
    hflip: bool(t, 'hflip'),
    vflip: bool(t, 'vflip'),
    rotate: bool(t, 'rotate'),
    preferuntransformed: bool(t, 'preferuntransformed')
  }
}

function parseTerrains(el: Element): TiledTerrain[] | undefined {
  const ttEl = child(el, 'terraintypes')
  if (!ttEl) return undefined
  return children(ttEl, 'terrain').map((t) => ({
    name: str(t, 'name'),
    tile: int(t, 'tile'),
    properties: parseProperties(t)
  }))
}

function parseWangSets(el: Element): TiledWangSet[] | undefined {
  const wsEl = child(el, 'wangsets')
  if (!wsEl) return undefined

  return children(wsEl, 'wangset').map((ws) => {
    const colors: TiledWangColor[] = children(ws, 'wangcolor').map((wc) => ({
      class: optStr(wc, 'class'),
      color: str(wc, 'color'),
      name: str(wc, 'name'),
      probability: float(wc, 'probability'),
      tile: int(wc, 'tile'),
      properties: parseProperties(wc)
    }))

    const tiles: TiledWangTile[] = children(ws, 'wangtile').map((wt) => ({
      tileid: int(wt, 'tileid'),
      wangid: str(wt, 'wangid').split(',').map(Number)
    }))

    return {
      class: optStr(ws, 'class'),
      colors,
      name: str(ws, 'name'),
      properties: parseProperties(ws),
      tile: int(ws, 'tile'),
      type: str(ws, 'type', 'corner') as TiledWangSetType,
      wangtiles: tiles
    } satisfies TiledWangSet
  })
}

function parseAnimation(el: Element, properties?: TiledProperty[]): TiledFrame[] | undefined {
  const animEl = child(el, 'animation')
  if (!animEl) return properties ? parseLegacyAnimation(properties) : undefined
  return children(animEl, 'frame').map((f) => ({
    tileid: int(f, 'tileid'),
    duration: int(f, 'duration')
  }))
}

/**
 * Tiled's TMX reader turns TMW/ManaPlus `animation-frameN` / `animation-delayN`
 * properties into a tile animation, with delays in 10 ms units. Mirror that so
 * such tilesets animate here as they do in the editor.
 */
function parseLegacyAnimation(properties: TiledProperty[]): TiledFrame[] | undefined {
  const values = new Map(properties.map((p) => [p.name, p.value]))
  const frames: TiledFrame[] = []
  for (let i = 0; values.has(`animation-frame${i}`) && values.has(`animation-delay${i}`); i++) {
    frames.push({
      tileid: toInt(values.get(`animation-frame${i}`)),
      duration: toInt(values.get(`animation-delay${i}`)) * 10
    })
  }
  return frames.length > 0 ? frames : undefined
}

function toInt(value: TiledPropertyValue | undefined): number {
  const n = parseInt(String(value), 10)
  return Number.isNaN(n) ? 0 : n
}

function parseTileDefinitions(
  el: Element,
  parseObjectGroup?: ObjectGroupParser
): TiledTileDefinition[] | undefined {
  const tileEls = children(el, 'tile')
  if (tileEls.length === 0) return undefined

  return tileEls.map((t) => {
    const img = parseImage(t)
    const terrainAttr = optStr(t, 'terrain')
    const terrain = terrainAttr
      ? terrainAttr.split(',').map((v) => (v === '' ? -1 : parseInt(v, 10)))
      : undefined

    const ogEl = child(t, 'objectgroup')
    const objectgroup = ogEl && parseObjectGroup ? parseObjectGroup(ogEl) : undefined
    const properties = parseProperties(t)

    return {
      id: int(t, 'id'),
      type: optStr(t, 'type') ?? optStr(t, 'class'),
      probability: optFloat(t, 'probability'),
      x: optInt(t, 'x'),
      y: optInt(t, 'y'),
      width: optInt(t, 'width'),
      height: optInt(t, 'height'),
      properties,
      animation: parseAnimation(t, properties),
      terrain,
      objectgroup,
      ...img
    }
  })
}
