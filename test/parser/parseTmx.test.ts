/**
 * @vitest-environment jsdom
 */
import { DOMAdapter, WebWorkerAdapter } from 'pixi.js'
import { afterEach, describe, expect, it } from 'vitest'
import { parseTmx, parseTsx, parseTx } from '../../src/parser/parseTmx.js'
import { parseMap } from '../../src/parser/resolveMap.js'
import type { ResolvedObjectLayer } from '../../src/types/index.js'

describe('parseTmx', () => {
  it('parses a minimal orthogonal map', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" tiledversion="1.11.0" orientation="orthogonal"
     renderorder="right-down" width="2" height="2"
     tilewidth="32" tileheight="32" infinite="0"
     nextlayerid="2" nextobjectid="1">
  <tileset firstgid="1" name="test" tilewidth="32" tileheight="32"
           tilecount="4" columns="2">
    <image source="tiles.png" width="64" height="64"/>
  </tileset>
  <layer id="1" name="ground" width="2" height="2">
    <data encoding="csv">
1,2,
3,4
    </data>
  </layer>
</map>`

    const map = parseTmx(xml)
    expect(map.type).toBe('map')
    expect(map.orientation).toBe('orthogonal')
    expect(map.renderorder).toBe('right-down')
    expect(map.width).toBe(2)
    expect(map.height).toBe(2)
    expect(map.tilewidth).toBe(32)
    expect(map.tileheight).toBe(32)
    expect(map.infinite).toBe(false)
    expect(map.version).toBe('1.10')
    expect(map.tiledversion).toBe('1.11.0')

    // Tileset
    expect(map.tilesets).toHaveLength(1)
    const ts = map.tilesets[0]!
    expect('name' in ts).toBe(true)
    if ('name' in ts) {
      expect(ts.name).toBe('test')
      expect(ts.firstgid).toBe(1)
      expect(ts.tilecount).toBe(4)
      expect(ts.columns).toBe(2)
      expect(ts.image).toBe('tiles.png')
      expect(ts.imagewidth).toBe(64)
    }

    // Layer
    expect(map.layers).toHaveLength(1)
    const layer = map.layers[0]!
    expect(layer.type).toBe('tilelayer')
    expect(layer.name).toBe('ground')
    expect(layer.data).toEqual([1, 2, 3, 4])
  })

  it('parses base64 encoded tile data', () => {
    // base64 of four little-endian uint32: 1, 2, 3, 0
    // 1 = 01000000, 2 = 02000000, 3 = 03000000, 0 = 00000000
    const b64 = btoa(String.fromCharCode(1, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0))
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" orientation="orthogonal" width="2" height="2"
     tilewidth="32" tileheight="32" infinite="0"
     nextlayerid="2" nextobjectid="1">
  <layer id="1" name="base64layer" width="2" height="2">
    <data encoding="base64">${b64}</data>
  </layer>
</map>`

    const map = parseTmx(xml)
    const layer = map.layers[0]!
    expect(layer.encoding).toBe('base64')
    expect(typeof layer.data).toBe('string')
  })

  it('parses an external tileset reference', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" orientation="orthogonal" width="1" height="1"
     tilewidth="32" tileheight="32" infinite="0"
     nextlayerid="2" nextobjectid="1">
  <tileset firstgid="1" source="external.tsx"/>
</map>`

    const map = parseTmx(xml)
    expect(map.tilesets).toHaveLength(1)
    const ts = map.tilesets[0]!
    expect('source' in ts).toBe(true)
    if ('source' in ts) {
      expect(ts.source).toBe('external.tsx')
      expect(ts.firstgid).toBe(1)
    }
  })

  it('parses object layers with shapes', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" orientation="orthogonal" width="10" height="10"
     tilewidth="32" tileheight="32" infinite="0"
     nextlayerid="3" nextobjectid="6">
  <objectgroup id="2" name="objects" color="#ff0000">
    <object id="1" name="rect" x="10" y="20" width="50" height="30"/>
    <object id="2" name="circle" x="100" y="100" width="40" height="40">
      <ellipse/>
    </object>
    <object id="3" name="marker" x="200" y="200">
      <point/>
    </object>
    <object id="4" name="tri" x="50" y="50">
      <polygon points="0,0 50,0 25,50"/>
    </object>
    <object id="5" name="line" x="0" y="0">
      <polyline points="0,0 100,0 100,100"/>
    </object>
  </objectgroup>
</map>`

    const map = parseTmx(xml)
    expect(map.layers).toHaveLength(1)
    const layer = map.layers[0]!
    expect(layer.type).toBe('objectgroup')
    expect(layer.color).toBe('#ff0000')
    expect(layer.objects).toHaveLength(5)

    const rect = layer.objects![0]!
    expect(rect.name).toBe('rect')
    expect(rect.width).toBe(50)
    expect(rect.height).toBe(30)

    const circle = layer.objects![1]!
    expect(circle.ellipse).toBe(true)

    const point = layer.objects![2]!
    expect(point.point).toBe(true)

    const poly = layer.objects![3]!
    expect(poly.polygon).toHaveLength(3)
    expect(poly.polygon![0]).toEqual({ x: 0, y: 0 })
    expect(poly.polygon![2]).toEqual({ x: 25, y: 50 })

    const pline = layer.objects![4]!
    expect(pline.polyline).toHaveLength(3)
  })

  it('parses text objects', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" orientation="orthogonal" width="10" height="10"
     tilewidth="32" tileheight="32" infinite="0"
     nextlayerid="2" nextobjectid="2">
  <objectgroup id="1" name="texts">
    <object id="1" name="label" x="10" y="10" width="100" height="50">
      <text fontfamily="Arial" pixelsize="16" bold="1" color="#ff0000" halign="center">Hello World</text>
    </object>
  </objectgroup>
</map>`

    const map = parseTmx(xml)
    const obj = map.layers[0]!.objects![0]!
    expect(obj.text!.text).toBe('Hello World')
    expect(obj.text!.fontfamily).toBe('Arial')
    expect(obj.text!.pixelsize).toBe(16)
    expect(obj.text!.bold).toBe(true)
    expect(obj.text!.color).toBe('#ff0000')
    expect(obj.text!.halign).toBe('center')
  })

  it('parses image layers', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" orientation="orthogonal" width="10" height="10"
     tilewidth="32" tileheight="32" infinite="0"
     nextlayerid="2" nextobjectid="1">
  <imagelayer id="1" name="bg" offsetx="5" offsety="10" repeatx="1">
    <image source="background.png" width="640" height="480"/>
  </imagelayer>
</map>`

    const map = parseTmx(xml)
    expect(map.layers).toHaveLength(1)
    const layer = map.layers[0]!
    expect(layer.type).toBe('imagelayer')
    expect(layer.name).toBe('bg')
    expect(layer.image).toBe('background.png')
    expect(layer.offsetx).toBe(5)
    expect(layer.offsety).toBe(10)
    expect(layer.repeatx).toBe(true)
  })

  it('parses group layers recursively', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" orientation="orthogonal" width="2" height="2"
     tilewidth="32" tileheight="32" infinite="0"
     nextlayerid="4" nextobjectid="1">
  <group id="1" name="mygroup" opacity="0.5">
    <layer id="2" name="inner" width="2" height="2">
      <data encoding="csv">1,0,0,1</data>
    </layer>
    <objectgroup id="3" name="innerobjects"/>
  </group>
</map>`

    const map = parseTmx(xml)
    expect(map.layers).toHaveLength(1)
    const group = map.layers[0]!
    expect(group.type).toBe('group')
    expect(group.name).toBe('mygroup')
    expect(group.opacity).toBe(0.5)
    expect(group.layers).toHaveLength(2)
    expect(group.layers![0]!.type).toBe('tilelayer')
    expect(group.layers![1]!.type).toBe('objectgroup')
  })

  it('parses custom properties', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" orientation="orthogonal" width="1" height="1"
     tilewidth="32" tileheight="32" infinite="0"
     nextlayerid="2" nextobjectid="1">
  <properties>
    <property name="title" value="My Map"/>
    <property name="difficulty" type="int" value="5"/>
    <property name="speed" type="float" value="1.5"/>
    <property name="active" type="bool" value="true"/>
  </properties>
</map>`

    const map = parseTmx(xml)
    expect(map.properties).toHaveLength(4)
    expect(map.properties![0]).toEqual({
      name: 'title',
      type: 'string',
      propertytype: undefined,
      value: 'My Map'
    })
    expect(map.properties![1]).toEqual({
      name: 'difficulty',
      type: 'int',
      propertytype: undefined,
      value: 5
    })
    expect(map.properties![2]).toEqual({
      name: 'speed',
      type: 'float',
      propertytype: undefined,
      value: 1.5
    })
    expect(map.properties![3]).toEqual({
      name: 'active',
      type: 'bool',
      propertytype: undefined,
      value: true
    })
  })

  it('reads Tiled 1.12 map and layer attributes', () => {
    const map = parseTmx(`<map version="1.10" orientation="oblique" width="1" height="1"
     tilewidth="16" tileheight="16" skewx="4" skewy="-2" nextlayerid="3" nextobjectid="2">
  <layer id="1" name="ground" mode="screen" width="1" height="1"><data encoding="csv">0</data></layer>
  <objectgroup id="2" name="things">
    <object id="1" x="0" y="0" width="8" height="4" opacity="0.25"><capsule/></object>
  </objectgroup>
</map>`)

    expect(map).toMatchObject({ orientation: 'oblique', skewx: 4, skewy: -2 })
    expect(map.layers[0]!.mode).toBe('screen')
    expect(map.layers[1]!.objects![0]).toMatchObject({ opacity: 0.25, capsule: true })
  })

  it('normalizes a TMX image color key to the JSON form', () => {
    const map = parseMap(
      parseTmx(`<map version="1.10" orientation="orthogonal" width="1" height="1"
     tilewidth="16" tileheight="16" nextlayerid="2" nextobjectid="1">
  <tileset firstgid="1" name="t" tilewidth="16" tileheight="16" tilecount="1" columns="1">
    <image source="t.png" trans="ff00ff" width="16" height="16"/>
  </tileset>
  <imagelayer id="1" name="bg"><image source="bg.png" trans="00ff00"/></imagelayer>
</map>`)
    )

    expect(map.tilesets[0]!.transparentcolor).toBe('#ff00ff')
    expect(map.layers[0]).toMatchObject({ transparentcolor: '#00ff00' })
  })

  describe('structured properties match the values Tiled writes to JSON', () => {
    function parseMapProperties(propertiesXml: string) {
      return parseTmx(`<map version="1.10" orientation="orthogonal" width="1" height="1"
     tilewidth="32" tileheight="32" nextlayerid="1" nextobjectid="1">
  <properties>${propertiesXml}</properties>
</map>`).properties
    }

    it('reads an object reference as its numeric id', () => {
      expect(parseMapProperties('<property name="target" type="object" value="12"/>')).toEqual([
        { name: 'target', type: 'object', propertytype: undefined, value: 12 }
      ])
    })

    it('reads class members, including nested classes, into a plain object', () => {
      const props = parseMapProperties(`
    <property name="stats" type="class" propertytype="Stats">
      <properties>
        <property name="hp" type="int" value="5"/>
        <property name="name" value="orc"/>
        <property name="pos" type="class" propertytype="Point">
          <properties><property name="x" type="float" value="1.5"/></properties>
        </property>
      </properties>
    </property>
    <property name="empty" type="class" propertytype="Stats"/>`)

      expect(props).toEqual([
        {
          name: 'stats',
          type: 'class',
          propertytype: 'Stats',
          value: { hp: 5, name: 'orc', pos: { x: 1.5 } }
        },
        { name: 'empty', type: 'class', propertytype: 'Stats', value: {} }
      ])
    })

    it('reads list items as typed entries', () => {
      const props = parseMapProperties(`
    <property name="loot" type="list">
      <item type="int" value="3"/>
      <item value="gold"/>
      <item type="class" propertytype="Point">
        <properties><property name="x" type="int" value="2"/></properties>
      </item>
    </property>`)

      expect(props).toEqual([
        {
          name: 'loot',
          type: 'list',
          propertytype: undefined,
          value: [
            { type: 'int', propertytype: undefined, value: 3 },
            { type: 'string', propertytype: undefined, value: 'gold' },
            { type: 'class', propertytype: 'Point', value: { x: 2 } }
          ]
        }
      ])
    })
  })

  it('parses tile animations', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" orientation="orthogonal" width="1" height="1"
     tilewidth="32" tileheight="32" infinite="0"
     nextlayerid="2" nextobjectid="1">
  <tileset firstgid="1" name="anim" tilewidth="32" tileheight="32"
           tilecount="4" columns="2">
    <image source="anim.png" width="64" height="64"/>
    <tile id="0">
      <animation>
        <frame tileid="0" duration="100"/>
        <frame tileid="1" duration="100"/>
        <frame tileid="2" duration="200"/>
      </animation>
    </tile>
  </tileset>
</map>`

    const map = parseTmx(xml)
    const ts = map.tilesets[0]!
    const tile0 = 'tiles' in ts ? ts.tiles?.find((t) => t.id === 0) : undefined
    expect(tile0?.animation).toHaveLength(3)
    expect(tile0?.animation?.[0]).toEqual({ tileid: 0, duration: 100 })
    expect(tile0?.animation?.[2]).toEqual({ tileid: 2, duration: 200 })
  })

  describe('TMW-style animation properties', () => {
    const tsxWithTile = (tileXml: string) => `<?xml version="1.0" encoding="UTF-8"?>
<tileset name="water" tilewidth="32" tileheight="32" tilecount="4" columns="2">
  <image source="water.png" width="64" height="64"/>
  <tile id="0">${tileXml}</tile>
</tileset>`
    const props = (entries: Record<string, string>) =>
      `<properties>${Object.entries(entries)
        .map(([name, value]) => `<property name="${name}" value="${value}"/>`)
        .join('')}</properties>`

    it('turns animation-frameN/animation-delayN into frames like Tiled does', () => {
      const ts = parseTsx(
        tsxWithTile(
          props({
            'animation-delay0': '50',
            'animation-delay1': '20',
            'animation-frame0': '0',
            'animation-frame1': '3'
          })
        )
      )
      expect(ts.tiles?.[0]?.animation).toEqual([
        { tileid: 0, duration: 500 },
        { tileid: 3, duration: 200 }
      ])
    })

    it('stops at the first frame without a matching delay', () => {
      const ts = parseTsx(
        tsxWithTile(
          props({
            'animation-frame0': '1',
            'animation-delay0': '10',
            'animation-frame1': '2',
            'animation-frame2': '3',
            'animation-delay2': '10'
          })
        )
      )
      expect(ts.tiles?.[0]?.animation).toEqual([{ tileid: 1, duration: 100 }])
    })

    it('leaves the tile static when the first frame has no delay', () => {
      const ts = parseTsx(tsxWithTile(props({ 'animation-frame0': '1' })))
      expect(ts.tiles?.[0]?.animation).toBeUndefined()
    })

    it('prefers an <animation> element over the properties', () => {
      const ts = parseTsx(
        tsxWithTile(
          `${props({ 'animation-frame0': '1', 'animation-delay0': '10' })}
          <animation><frame tileid="2" duration="70"/></animation>`
        )
      )
      expect(ts.tiles?.[0]?.animation).toEqual([{ tileid: 2, duration: 70 }])
    })
  })

  it('parses infinite map with chunks', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" orientation="orthogonal" width="4" height="4"
     tilewidth="32" tileheight="32" infinite="1"
     nextlayerid="2" nextobjectid="1">
  <tileset firstgid="1" name="test" tilewidth="32" tileheight="32"
           tilecount="4" columns="2">
    <image source="tiles.png" width="64" height="64"/>
  </tileset>
  <layer id="1" name="ground" width="4" height="4">
    <data encoding="csv">
      <chunk x="0" y="0" width="2" height="2">
1,2,
3,4
      </chunk>
      <chunk x="2" y="0" width="2" height="2">
1,0,
0,2
      </chunk>
    </data>
  </layer>
</map>`

    const map = parseTmx(xml)
    expect(map.infinite).toBe(true)
    const layer = map.layers[0]!
    expect(layer.chunks).toHaveLength(2)
    expect(layer.chunks![0]!.x).toBe(0)
    expect(layer.chunks![0]!.data).toEqual([1, 2, 3, 4])
    expect(layer.chunks![1]!.x).toBe(2)
    expect(layer.chunks![1]!.data).toEqual([1, 0, 0, 2])
  })

  it('parses hexagonal map attributes', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" orientation="hexagonal" width="5" height="5"
     tilewidth="64" tileheight="64" hexsidelength="32"
     staggeraxis="y" staggerindex="odd" infinite="0"
     nextlayerid="2" nextobjectid="1">
</map>`

    const map = parseTmx(xml)
    expect(map.orientation).toBe('hexagonal')
    expect(map.hexsidelength).toBe(32)
    expect(map.staggeraxis).toBe('y')
    expect(map.staggerindex).toBe('odd')
  })

  it('calculates columns from image dimensions when attribute is missing', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.0" orientation="isometric" renderorder="right-down"
     width="2" height="2" tilewidth="256" tileheight="128" infinite="0"
     nextlayerid="2" nextobjectid="1">
  <tileset firstgid="1" name="base" tilewidth="256" tileheight="256" tilecount="92">
    <image source="256_base.png" width="1024" height="6000"/>
  </tileset>
</map>`

    const map = parseTmx(xml)
    const ts = map.tilesets[0]!
    expect('columns' in ts).toBe(true)
    if ('columns' in ts) {
      expect(ts.columns).toBe(4) // 1024 / 256
    }
  })

  it('calculates columns accounting for margin and spacing', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.0" orientation="orthogonal" width="1" height="1"
     tilewidth="32" tileheight="32" infinite="0"
     nextlayerid="2" nextobjectid="1">
  <tileset firstgid="1" name="spaced" tilewidth="32" tileheight="32"
           tilecount="4" margin="2" spacing="1">
    <image source="tiles.png" width="69" height="69"/>
  </tileset>
</map>`

    const map = parseTmx(xml)
    const ts = map.tilesets[0]!
    if ('columns' in ts) {
      // (69 - 2*2 + 1) / (32 + 1) = 66 / 33 = 2
      expect(ts.columns).toBe(2)
    }
  })

  it('throws on invalid XML', () => {
    expect(() => parseTmx('<not-a-map/>')).toThrow('Expected root <map>')
  })
})

describe('parseTsx', () => {
  it('parses an external tileset file', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<tileset name="terrain" tilewidth="32" tileheight="32"
         tilecount="16" columns="4">
  <image source="terrain.png" width="128" height="128"/>
  <tile id="0">
    <properties>
      <property name="walkable" type="bool" value="true"/>
    </properties>
  </tile>
</tileset>`

    const ts = parseTsx(xml)
    expect(ts.name).toBe('terrain')
    expect(ts.tilewidth).toBe(32)
    expect(ts.tilecount).toBe(16)
    expect(ts.columns).toBe(4)
    expect(ts.image).toBe('terrain.png')
    expect(ts.tiles).toHaveLength(1)
    expect(ts.tiles![0]!.id).toBe(0)
    expect(ts.tiles![0]!.properties).toHaveLength(1)
  })

  it('reports firstgid 0 for a TSX file, leaving the real value to the referencing map', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<tileset name="terrain" tilewidth="32" tileheight="32" tilecount="16" columns="4">
  <image source="terrain.png" width="128" height="128"/>
</tileset>`

    // A TSX file has no firstgid attribute. parseTsx keeps the TiledTileset
    // shape with a 0 placeholder; resolution always takes the map's value.
    expect(parseTsx(xml).firstgid).toBe(0)
  })

  it('throws on non-tileset root', () => {
    expect(() => parseTsx('<map/>')).toThrow('Expected root <tileset>')
  })
})

describe('parseTsx versions and legacy Wang sets', () => {
  it('reads the format and editor version of a TSX file', () => {
    const ts = parseTsx(`<tileset version="1.10" tiledversion="1.11.2" name="t"
      tilewidth="16" tileheight="16" tilecount="1" columns="1"/>`)
    expect(ts).toMatchObject({ version: '1.10', tiledversion: '1.11.2' })
  })

  it('reads a pre-1.5 Wang set with hex ids and separate corner colors', () => {
    const ts = parseTsx(`<tileset name="t" tilewidth="16" tileheight="16" tilecount="2" columns="2">
  <wangsets>
    <wangset name="paths" tile="-1">
      <wangcornercolor name="grass" color="#00ff00" tile="-1" probability="1"/>
      <wangcornercolor name="sand" color="#ffff00" tile="-1" probability="1"/>
      <wangtile tileid="0" wangid="0x20101010"/>
    </wangset>
  </wangsets>
</tileset>`)

    const wangset = ts.wangsets![0]!
    expect(wangset.type).toBe('corner')
    expect(wangset.colors.map((color) => color.name)).toEqual(['grass', 'sand'])
    // Nibbles, lowest first: edges 0, corners 1 1 1 2.
    expect(wangset.wangtiles[0]!.wangid).toEqual([0, 1, 0, 1, 0, 1, 0, 2])
  })

  it('maps legacy edge colors after corner colors onto the unified list', () => {
    const ts = parseTsx(`<tileset name="t" tilewidth="16" tileheight="16" tilecount="1" columns="1">
  <wangsets>
    <wangset name="mixed" tile="-1">
      <wangcornercolor name="c" color="#000000" tile="-1" probability="1"/>
      <wangedgecolor name="e" color="#ffffff" tile="-1" probability="1"/>
      <wangtile tileid="0" wangid="0x11"/>
    </wangset>
  </wangsets>
</tileset>`)

    // Edge color 1 is the second color overall; corner color 1 the first.
    expect(ts.wangsets![0]!.wangtiles[0]!.wangid).toEqual([2, 1, 0, 0, 0, 0, 0, 0])
  })
})

describe('parseTx', () => {
  it('parses a template with an object and an external tileset', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<template>
  <tileset firstgid="1" source="terrain.tsx"/>
  <object name="sign" type="decor" width="32" height="32" gid="5">
    <properties>
      <property name="blocks" type="bool" value="true"/>
    </properties>
  </object>
</template>`

    const tpl = parseTx(xml)
    expect(tpl.type).toBe('template')
    expect(tpl.tileset).toEqual({ firstgid: 1, source: 'terrain.tsx' })
    expect(tpl.object.name).toBe('sign')
    expect(tpl.object.type).toBe('decor')
    expect(tpl.object.gid).toBe(5)
    expect(tpl.object.width).toBe(32)
    expect(tpl.object.properties).toHaveLength(1)
    expect(tpl.object.properties?.[0]?.name).toBe('blocks')
    expect(tpl.object.properties?.[0]?.value).toBe(true)
  })

  it('parses a template without a tileset', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<template>
  <object name="spawnpoint" type="point" width="16" height="16">
    <point/>
  </object>
</template>`

    const tpl = parseTx(xml)
    expect(tpl.tileset).toBeUndefined()
    expect(tpl.object.name).toBe('spawnpoint')
    expect(tpl.object.point).toBe(true)
  })

  it('throws when root element is not <template>', () => {
    expect(() => parseTx('<map/>')).toThrow('Expected root <template>')
  })

  it('throws when template has no <object>', () => {
    expect(() => parseTx('<template/>')).toThrow('missing <object>')
  })

  it('lets a TMX instance inherit every field it does not write', () => {
    const template = parseTx(`<template>
  <object name="rock" type="prop" width="16" height="8" rotation="45" visible="0" opacity="0.5">
    <properties><property name="a" value="A"/></properties>
    <ellipse/>
  </object>
</template>`)
    const map = parseTmx(`<map version="1.10" orientation="orthogonal" width="1" height="1"
     tilewidth="32" tileheight="32" nextlayerid="2" nextobjectid="3">
  <objectgroup id="1" name="objects">
    <object id="1" template="rock.tx" x="5" y="6">
      <properties><property name="b" value="B"/></properties>
    </object>
    <object id="2" template="rock.tx" name="" x="7" y="8" rotation="0" visible="1"/>
  </objectgroup>
</map>`)

    const layer = parseMap(map, { templates: new Map([['rock.tx', template]]) })
      .layers[0] as ResolvedObjectLayer
    expect(layer.objects[0]).toMatchObject({
      name: 'rock',
      type: 'prop',
      x: 5,
      y: 6,
      width: 16,
      height: 8,
      rotation: 45,
      visible: false,
      ellipse: true,
      properties: [
        { name: 'a', value: 'A' },
        { name: 'b', value: 'B' }
      ]
    })
    expect(layer.objects[1]).toMatchObject({ name: '', rotation: 0, visible: true })
  })
})

// Regression for https://github.com/riebel/pixi-tiledmap/issues/29: the XML
// parsers must not depend on browser-only DOM APIs (DOMParser, querySelector,
// Element.children). Driving them through Pixi's WebWorkerAdapter, which is
// backed by @xmldom/xmldom, exercises the worker/Node code path.
describe('XML parsing under WebWorkerAdapter (xmldom)', () => {
  const original = DOMAdapter.get()

  afterEach(() => {
    // Restore the jsdom-backed default for the remaining suites in this file.
    DOMAdapter.set(original)
  })

  it('parses a TMX map with nested layers', () => {
    DOMAdapter.set(WebWorkerAdapter)

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" orientation="orthogonal" renderorder="right-down"
     width="2" height="1" tilewidth="32" tileheight="32" infinite="0"
     nextlayerid="3" nextobjectid="1">
  <tileset firstgid="1" name="test" tilewidth="32" tileheight="32"
           tilecount="2" columns="2">
    <image source="test.png" width="64" height="32"/>
  </tileset>
  <group id="2" name="grp">
    <layer id="1" name="ground" width="2" height="1">
      <data encoding="csv">1,2</data>
    </layer>
  </group>
</map>`

    const map = parseTmx(xml)
    expect(map.width).toBe(2)
    expect(map.tilesets).toHaveLength(1)
    expect(map.layers).toHaveLength(1)
    expect(map.layers[0]!.type).toBe('group')
    const group = map.layers[0] as { layers: { name: string }[] }
    expect(group.layers[0]!.name).toBe('ground')
  })

  it('parses a TSX tileset', () => {
    DOMAdapter.set(WebWorkerAdapter)

    const ts = parseTsx(
      `<tileset name="terrain" tilewidth="32" tileheight="32" tilecount="4" columns="2">
         <image source="terrain.png" width="64" height="64"/>
       </tileset>`
    )
    expect(ts.name).toBe('terrain')
    expect(ts.image).toBe('terrain.png')
  })

  it('parses a TX object template', () => {
    DOMAdapter.set(WebWorkerAdapter)

    const tpl = parseTx(
      `<template>
         <object name="spawnpoint" type="marker">
           <point/>
         </object>
       </template>`
    )
    expect(tpl.type).toBe('template')
    expect(tpl.object.name).toBe('spawnpoint')
    expect(tpl.object.point).toBe(true)
  })

  it('keeps an empty tile layer of an infinite map infinite', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" orientation="orthogonal" renderorder="right-down" width="10" height="10"
     tilewidth="16" tileheight="16" infinite="1" nextlayerid="2" nextobjectid="1">
  <group id="3" name="group">
    <layer id="1" name="empty" width="10" height="10">
      <data encoding="csv"/>
    </layer>
  </group>
</map>`

    const raw = parseTmx(xml)
    const group = raw.layers[0]
    const layer = group?.layers?.[0]
    expect(layer?.chunks).toEqual([])
    expect(layer?.data).toBeUndefined()

    const resolved = parseMap(raw).layers[0]
    const tileLayer = resolved?.type === 'group' ? resolved.layers[0] : undefined
    expect(tileLayer).toMatchObject({ type: 'tilelayer', infinite: true, chunks: [] })
  })
})
