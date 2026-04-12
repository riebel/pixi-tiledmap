import type {
  TiledChunk,
  TiledCompression,
  TiledDrawOrder,
  TiledEncoding,
  TiledFillMode,
  TiledFrame,
  TiledGrid,
  TiledGridOrientation,
  TiledHAlign,
  TiledLayer,
  TiledLayerType,
  TiledMap,
  TiledObject,
  TiledObjectAlignment,
  TiledObjectTemplate,
  TiledOrientation,
  TiledPoint,
  TiledProperty,
  TiledPropertyType,
  TiledRenderOrder,
  TiledStaggerAxis,
  TiledStaggerIndex,
  TiledTerrain,
  TiledText,
  TiledTileDefinition,
  TiledTileOffset,
  TiledTileRenderSize,
  TiledTileset,
  TiledTilesetRef,
  TiledTransformations,
  TiledVAlign,
  TiledWangColor,
  TiledWangSet,
  TiledWangSetType,
  TiledWangTile
} from '../types'

// ─── Attribute helpers ──────────────────────────────────────────────────────

function str(el: Element, name: string, fallback = ''): string {
  return el.getAttribute(name) ?? fallback
}

function int(el: Element, name: string, fallback = 0): number {
  const v = el.getAttribute(name)
  return v != null ? parseInt(v, 10) : fallback
}

function float(el: Element, name: string, fallback = 0): number {
  const v = el.getAttribute(name)
  return v != null ? parseFloat(v) : fallback
}

function bool(el: Element, name: string, fallback = false): boolean {
  const v = el.getAttribute(name)
  if (v == null) return fallback
  return v === '1' || v === 'true'
}

function optStr(el: Element, name: string): string | undefined {
  const v = el.getAttribute(name)
  return v != null ? v : undefined
}

function optInt(el: Element, name: string): number | undefined {
  const v = el.getAttribute(name)
  return v != null ? parseInt(v, 10) : undefined
}

function optFloat(el: Element, name: string): number | undefined {
  const v = el.getAttribute(name)
  return v != null ? parseFloat(v) : undefined
}

function children(el: Element, tag: string): Element[] {
  const result: Element[] = []
  for (let i = 0; i < el.children.length; i++) {
    const child = el.children[i]!
    if (child.tagName === tag) result.push(child)
  }
  return result
}

function child(el: Element, tag: string): Element | null {
  for (let i = 0; i < el.children.length; i++) {
    const c = el.children[i]!
    if (c.tagName === tag) return c
  }
  return null
}

// ─── Properties ─────────────────────────────────────────────────────────────

function parseProperties(el: Element): TiledProperty[] | undefined {
  const propsEl = child(el, 'properties')
  if (!propsEl) return undefined

  const props: TiledProperty[] = []
  for (const pEl of children(propsEl, 'property')) {
    const type = str(pEl, 'type', 'string') as TiledPropertyType
    let value: string | number | boolean = str(pEl, 'value', '')
    // If value not in attribute, check text content (multiline strings)
    if (!pEl.hasAttribute('value')) {
      value = pEl.textContent ?? ''
    }
    if (type === 'int') value = parseInt(value as string, 10)
    else if (type === 'float') value = parseFloat(value as string)
    else if (type === 'bool') value = value === 'true'

    props.push({
      name: str(pEl, 'name'),
      type,
      propertytype: optStr(pEl, 'propertytype'),
      value
    })
  }
  return props.length > 0 ? props : undefined
}

// ─── Image ──────────────────────────────────────────────────────────────────

interface ImageInfo {
  image?: string
  imagewidth?: number
  imageheight?: number
  transparentcolor?: string
}

function parseImage(el: Element): ImageInfo {
  const imgEl = child(el, 'image')
  if (!imgEl) return {}
  return {
    image: optStr(imgEl, 'source'),
    imagewidth: optInt(imgEl, 'width'),
    imageheight: optInt(imgEl, 'height'),
    transparentcolor: optStr(imgEl, 'trans')
  }
}

// ─── Tile offset ────────────────────────────────────────────────────────────

function parseTileOffset(el: Element): TiledTileOffset | undefined {
  const to = child(el, 'tileoffset')
  if (!to) return undefined
  return { x: int(to, 'x'), y: int(to, 'y') }
}

// ─── Grid ───────────────────────────────────────────────────────────────────

function parseGrid(el: Element): TiledGrid | undefined {
  const g = child(el, 'grid')
  if (!g) return undefined
  return {
    orientation: str(g, 'orientation', 'orthogonal') as TiledGridOrientation,
    width: int(g, 'width'),
    height: int(g, 'height')
  }
}

// ─── Transformations ────────────────────────────────────────────────────────

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

// ─── Terrain ────────────────────────────────────────────────────────────────

function parseTerrains(el: Element): TiledTerrain[] | undefined {
  const ttEl = child(el, 'terraintypes')
  if (!ttEl) return undefined
  return children(ttEl, 'terrain').map((t) => ({
    name: str(t, 'name'),
    tile: int(t, 'tile'),
    properties: parseProperties(t)
  }))
}

// ─── Wang sets ──────────────────────────────────────────────────────────────

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

// ─── Animation ──────────────────────────────────────────────────────────────

function parseAnimation(el: Element): TiledFrame[] | undefined {
  const animEl = child(el, 'animation')
  if (!animEl) return undefined
  return children(animEl, 'frame').map((f) => ({
    tileid: int(f, 'tileid'),
    duration: int(f, 'duration')
  }))
}

// ─── Tile definitions ───────────────────────────────────────────────────────

function parseTileDefinitions(el: Element): TiledTileDefinition[] | undefined {
  const tileEls = children(el, 'tile')
  if (tileEls.length === 0) return undefined

  return tileEls.map((t) => {
    const img = parseImage(t)
    const terrainAttr = optStr(t, 'terrain')
    const terrain = terrainAttr
      ? terrainAttr.split(',').map((v) => (v === '' ? -1 : parseInt(v, 10)))
      : undefined

    // Object group (collision shapes)
    const ogEl = child(t, 'objectgroup')
    const objectgroup = ogEl ? parseObjectGroup(ogEl) : undefined

    const def: TiledTileDefinition = {
      id: int(t, 'id'),
      type: optStr(t, 'type') ?? optStr(t, 'class'),
      probability: optFloat(t, 'probability'),
      x: optInt(t, 'x'),
      y: optInt(t, 'y'),
      width: optInt(t, 'width'),
      height: optInt(t, 'height'),
      properties: parseProperties(t),
      animation: parseAnimation(t),
      terrain,
      objectgroup,
      ...img
    }

    return def
  })
}

// ─── Tileset ────────────────────────────────────────────────────────────────

function parseTileset(el: Element): TiledTileset | TiledTilesetRef {
  const source = optStr(el, 'source')
  if (source) {
    return {
      firstgid: int(el, 'firstgid'),
      source
    } satisfies TiledTilesetRef
  }

  const img = parseImage(el)
  const tiles = parseTileDefinitions(el)

  const tilewidth = int(el, 'tilewidth')
  const spacing = int(el, 'spacing')
  const margin = int(el, 'margin')
  const rawColumns = int(el, 'columns')
  const columns =
    rawColumns > 0
      ? rawColumns
      : img.imagewidth && tilewidth > 0
        ? Math.floor((img.imagewidth - 2 * margin + spacing) / (tilewidth + spacing))
        : 0

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
    tiles: tiles,
    tilewidth,
    transformations: parseTransformations(el),
    wangsets: parseWangSets(el),
    ...img
  } satisfies TiledTileset
}

// ─── Data / Chunks ──────────────────────────────────────────────────────────

function parseData(dataEl: Element): {
  data?: number[] | string
  encoding?: TiledEncoding
  compression?: TiledCompression
  chunks?: TiledChunk[]
} {
  const encoding = optStr(dataEl, 'encoding') as TiledEncoding | undefined
  const compression = optStr(dataEl, 'compression') as TiledCompression | undefined

  // Check for chunks (infinite maps)
  const chunkEls = children(dataEl, 'chunk')
  if (chunkEls.length > 0) {
    const chunks: TiledChunk[] = chunkEls.map((c) => ({
      x: int(c, 'x'),
      y: int(c, 'y'),
      width: int(c, 'width'),
      height: int(c, 'height'),
      data: parseDataContent(c, encoding)
    }))
    return { encoding, compression, chunks }
  }

  return {
    data: parseDataContent(dataEl, encoding),
    encoding,
    compression
  }
}

function parseDataContent(el: Element, encoding: TiledEncoding | undefined): number[] | string {
  if (encoding === 'base64') {
    return (el.textContent ?? '').trim()
  }

  if (encoding === 'csv') {
    return (el.textContent ?? '')
      .trim()
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
  }

  // XML tile elements (no encoding)
  const tileEls = children(el, 'tile')
  return tileEls.map((t) => int(t, 'gid'))
}

// ─── Objects ────────────────────────────────────────────────────────────────

function parsePoints(pointStr: string): TiledPoint[] {
  return pointStr
    .trim()
    .split(/\s+/)
    .map((pair) => {
      const [x, y] = pair.split(',').map(Number)
      return { x: x!, y: y! }
    })
}

function parseTextObject(el: Element): TiledText {
  return {
    text: el.textContent ?? '',
    fontfamily: optStr(el, 'fontfamily'),
    pixelsize: optInt(el, 'pixelsize'),
    wrap: bool(el, 'wrap') ? true : undefined,
    color: optStr(el, 'color'),
    bold: bool(el, 'bold') ? true : undefined,
    italic: bool(el, 'italic') ? true : undefined,
    underline: bool(el, 'underline') ? true : undefined,
    strikeout: bool(el, 'strikeout') ? true : undefined,
    kerning: el.hasAttribute('kerning') ? bool(el, 'kerning', true) : undefined,
    halign: optStr(el, 'halign') as TiledHAlign | undefined,
    valign: optStr(el, 'valign') as TiledVAlign | undefined
  }
}

function parseObject(el: Element): TiledObject {
  const obj: TiledObject = {
    id: int(el, 'id'),
    name: str(el, 'name'),
    type: str(el, 'type') || str(el, 'class'),
    x: float(el, 'x'),
    y: float(el, 'y'),
    width: float(el, 'width'),
    height: float(el, 'height'),
    rotation: float(el, 'rotation'),
    visible: el.hasAttribute('visible') ? bool(el, 'visible', true) : true,
    properties: parseProperties(el)
  }

  const gid = optInt(el, 'gid')
  if (gid != null) obj.gid = gid

  const template = optStr(el, 'template')
  if (template) obj.template = template

  if (child(el, 'ellipse')) obj.ellipse = true
  if (child(el, 'point')) obj.point = true

  const polygonEl = child(el, 'polygon')
  if (polygonEl) {
    obj.polygon = parsePoints(str(polygonEl, 'points'))
  }

  const polylineEl = child(el, 'polyline')
  if (polylineEl) {
    obj.polyline = parsePoints(str(polylineEl, 'points'))
  }

  const textEl = child(el, 'text')
  if (textEl) {
    obj.text = parseTextObject(textEl)
  }

  return obj
}

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

  const tilesets: (TiledTileset | TiledTilesetRef)[] = children(mapEl, 'tileset').map(parseTileset)

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

  const result = parseTileset(tsEl)
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
    tileset: tilesetEl ? parseTileset(tilesetEl) : undefined,
    object: parseObject(objectEl)
  }
}
