import type {
  TiledDrawOrder,
  TiledLayer,
  TiledLayerType,
  TiledMap,
  TiledObjectTemplate,
  TiledOrientation,
  TiledRenderOrder,
  TiledStaggerAxis,
  TiledStaggerIndex,
  TiledTileset,
  TiledTilesetRef
} from '../types'
import { parseData } from './tmxData.js'
import { parseObject } from './tmxObjects.js'
import { parseProperties } from './tmxProperties.js'
import { parseImage, parseTileset } from './tmxTilesets.js'
import { bool, child, children, float, int, optFloat, optInt, optStr, str } from './xmlHelpers.js'

// ─── Layers ─────────────────────────────────────────────────────────────────

function parseLayerCommon(el: Element): Partial<TiledLayer> {
  return {
    id: int(el, 'id'),
    name: str(el, 'name'),
    class: optStr(el, 'class'),
    opacity: float(el, 'opacity', 1),
    visible: el.hasAttribute('visible') ? bool(el, 'visible', true) : true,
    tintcolor: optStr(el, 'tintcolor'),
    offsetx: optFloat(el, 'offsetx'),
    offsety: optFloat(el, 'offsety'),
    parallaxx: optFloat(el, 'parallaxx'),
    parallaxy: optFloat(el, 'parallaxy'),
    locked: el.hasAttribute('locked') ? bool(el, 'locked') : undefined,
    properties: parseProperties(el),
    x: int(el, 'x'),
    y: int(el, 'y')
  }
}

function parseTileLayer(el: Element): TiledLayer {
  const dataEl = child(el, 'data')
  const dataInfo = dataEl ? parseData(dataEl) : {}

  return {
    ...parseLayerCommon(el),
    type: 'tilelayer' as TiledLayerType,
    width: optInt(el, 'width'),
    height: optInt(el, 'height'),
    startx: optInt(el, 'startx'),
    starty: optInt(el, 'starty'),
    ...dataInfo
  } as TiledLayer
}

function parseObjectGroup(el: Element): TiledLayer {
  return {
    ...parseLayerCommon(el),
    type: 'objectgroup' as TiledLayerType,
    draworder: optStr(el, 'draworder') as TiledDrawOrder | undefined,
    objects: children(el, 'object').map(parseObject)
  } as TiledLayer
}

function parseImageLayer(el: Element): TiledLayer {
  const img = parseImage(el)
  return {
    ...parseLayerCommon(el),
    type: 'imagelayer' as TiledLayerType,
    repeatx: el.hasAttribute('repeatx') ? bool(el, 'repeatx') : undefined,
    repeaty: el.hasAttribute('repeaty') ? bool(el, 'repeaty') : undefined,
    transparentcolor: img.transparentcolor,
    image: img.image,
    imagewidth: img.imagewidth,
    imageheight: img.imageheight
  } as TiledLayer
}

function parseGroupLayer(el: Element): TiledLayer {
  return {
    ...parseLayerCommon(el),
    type: 'group' as TiledLayerType,
    layers: parseLayers(el)
  } as TiledLayer
}

function parseLayers(parentEl: Element): TiledLayer[] {
  const layers: TiledLayer[] = []
  for (let i = 0; i < parentEl.children.length; i++) {
    const el = parentEl.children[i]!
    switch (el.tagName) {
      case 'layer':
        layers.push(parseTileLayer(el))
        break
      case 'objectgroup':
        layers.push(parseObjectGroup(el))
        break
      case 'imagelayer':
        layers.push(parseImageLayer(el))
        break
      case 'group':
        layers.push(parseGroupLayer(el))
        break
    }
  }
  return layers
}

// ─── Map ────────────────────────────────────────────────────────────────────

export function parseTmx(xml: string): TiledMap {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'text/xml')

  const errorNode = doc.querySelector('parsererror')
  if (errorNode) {
    throw new Error(`TMX XML parse error: ${errorNode.textContent}`)
  }

  const mapEl = doc.documentElement
  if (mapEl.tagName !== 'map') {
    throw new Error(`Expected root <map> element, got <${mapEl.tagName}>`)
  }

  const tilesets: (TiledTileset | TiledTilesetRef)[] = children(mapEl, 'tileset').map((el) =>
    parseTileset(el, parseObjectGroup)
  )

  const layers = parseLayers(mapEl)

  return {
    backgroundcolor: optStr(mapEl, 'backgroundcolor'),
    class: optStr(mapEl, 'class'),
    compressionlevel: optInt(mapEl, 'compressionlevel'),
    height: int(mapEl, 'height'),
    hexsidelength: optInt(mapEl, 'hexsidelength'),
    infinite: bool(mapEl, 'infinite'),
    layers,
    nextlayerid: int(mapEl, 'nextlayerid'),
    nextobjectid: int(mapEl, 'nextobjectid'),
    orientation: str(mapEl, 'orientation', 'orthogonal') as TiledOrientation,
    parallaxoriginx: optFloat(mapEl, 'parallaxoriginx'),
    parallaxoriginy: optFloat(mapEl, 'parallaxoriginy'),
    properties: parseProperties(mapEl),
    renderorder: optStr(mapEl, 'renderorder') as TiledRenderOrder | undefined,
    staggeraxis: optStr(mapEl, 'staggeraxis') as TiledStaggerAxis | undefined,
    staggerindex: optStr(mapEl, 'staggerindex') as TiledStaggerIndex | undefined,
    tiledversion: optStr(mapEl, 'tiledversion'),
    tileheight: int(mapEl, 'tileheight'),
    tilesets,
    tilewidth: int(mapEl, 'tilewidth'),
    type: 'map',
    version: str(mapEl, 'version', '1.0'),
    width: int(mapEl, 'width')
  }
}

export function parseTsx(xml: string): TiledTileset {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'text/xml')

  const errorNode = doc.querySelector('parsererror')
  if (errorNode) {
    throw new Error(`TSX XML parse error: ${errorNode.textContent}`)
  }

  const tsEl = doc.documentElement
  if (tsEl.tagName !== 'tileset') {
    throw new Error(`Expected root <tileset> element, got <${tsEl.tagName}>`)
  }

  const result = parseTileset(tsEl, parseObjectGroup)
  if ('source' in result) {
    throw new Error('TSX file should not contain a source reference')
  }
  return result
}

// ─── Template (TX) ──────────────────────────────────────────────────────────

export function parseTx(xml: string): TiledObjectTemplate {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'text/xml')

  const errorNode = doc.querySelector('parsererror')
  if (errorNode) {
    throw new Error(`TX XML parse error: ${errorNode.textContent}`)
  }

  const tplEl = doc.documentElement
  if (tplEl.tagName !== 'template') {
    throw new Error(`Expected root <template> element, got <${tplEl.tagName}>`)
  }

  const tilesetEl = child(tplEl, 'tileset')
  const objectEl = child(tplEl, 'object')
  if (!objectEl) {
    throw new Error('Template is missing <object>')
  }

  return {
    type: 'template',
    tileset: tilesetEl ? parseTileset(tilesetEl, parseObjectGroup) : undefined,
    object: parseObject(objectEl)
  }
}
