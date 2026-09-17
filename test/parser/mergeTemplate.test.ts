import { describe, expect, it } from 'vitest'
import { mergeTemplate } from '../../src/parser/mergeTemplate.js'
import type { ResolvedTileset, TiledObject, TiledObjectTemplate } from '../../src/types/index.js'
import { FLIPPED_HORIZONTALLY_FLAG, FLIPPED_VERTICALLY_FLAG } from '../../src/types/index.js'

/** A template instance as Tiled writes it: only the fields it overrides. */
function makeInstance(overrides: Partial<TiledObject> = {}): TiledObject {
  return { id: 1, type: '', x: 10, y: 20, ...overrides } as TiledObject
}

function makeTemplate(
  obj: Partial<TiledObject>,
  tileset?: TiledObjectTemplate['tileset']
): TiledObjectTemplate {
  return {
    type: 'template',
    tileset,
    object: {
      id: 0,
      name: 'from-template',
      type: 'enemy',
      x: 0,
      y: 0,
      width: 16,
      height: 16,
      rotation: 0,
      visible: true,
      ...obj
    }
  }
}

function makeTileset(firstgid: number, source?: string): ResolvedTileset {
  return {
    firstgid,
    name: 'tiles',
    source,
    tilewidth: 16,
    tileheight: 16,
    columns: 4,
    tilecount: 16,
    margin: 0,
    spacing: 0,
    tileoffset: { x: 0, y: 0 },
    objectalignment: 'unspecified',
    tilerendersize: 'tile',
    fillmode: 'stretch',
    tiles: new Map(),
    properties: []
  }
}

describe('mergeTemplate', () => {
  describe('field merging', () => {
    it('instance required fields always win', () => {
      const result = mergeTemplate(
        makeInstance({ id: 7, x: 100, y: 200, rotation: 45, visible: false }),
        makeTemplate({}),
        []
      )
      expect(result.id).toBe(7)
      expect(result.x).toBe(100)
      expect(result.y).toBe(200)
      expect(result.rotation).toBe(45)
      expect(result.visible).toBe(false)
    })

    it('template provides name and type when the instance omits them', () => {
      const result = mergeTemplate(makeInstance({ type: '' }), makeTemplate({}), [])
      expect(result.name).toBe('from-template')
      expect(result.type).toBe('enemy')
    })

    it('an instance name that was cleared stays empty', () => {
      const result = mergeTemplate(makeInstance({ name: '' }), makeTemplate({}), [])
      expect(result.name).toBe('')
    })

    it('template rotation and visibility apply when the instance omits them', () => {
      const result = mergeTemplate(
        makeInstance(),
        makeTemplate({ rotation: 45, visible: false }),
        []
      )
      expect(result.rotation).toBe(45)
      expect(result.visible).toBe(false)
    })

    it('an explicit zero rotation and visible instance override the template', () => {
      const result = mergeTemplate(
        makeInstance({ rotation: 0, visible: true }),
        makeTemplate({ rotation: 45, visible: false }),
        []
      )
      expect(result.rotation).toBe(0)
      expect(result.visible).toBe(true)
    })

    it('template opacity applies unless the instance sets its own', () => {
      expect(mergeTemplate(makeInstance(), makeTemplate({ opacity: 0.5 }), []).opacity).toBe(0.5)
      expect(
        mergeTemplate(makeInstance({ opacity: 1 }), makeTemplate({ opacity: 0.5 }), []).opacity
      ).toBe(1)
    })

    it('non-empty instance name and type override the template', () => {
      const result = mergeTemplate(
        makeInstance({ name: 'boss', type: 'npc' }),
        makeTemplate({}),
        []
      )
      expect(result.name).toBe('boss')
      expect(result.type).toBe('npc')
    })

    it('instance width and height override template', () => {
      const result = mergeTemplate(makeInstance({ width: 32, height: 48 }), makeTemplate({}), [])
      expect(result.width).toBe(32)
      expect(result.height).toBe(48)
    })

    it('template width and height used when the instance omits them', () => {
      const result = mergeTemplate(makeInstance(), makeTemplate({}), [])
      expect(result.width).toBe(16)
      expect(result.height).toBe(16)
    })

    it('polygon from instance overrides template polygon', () => {
      const pts = [
        { x: 0, y: 0 },
        { x: 10, y: 0 }
      ]
      const result = mergeTemplate(
        makeInstance({ polygon: pts }),
        makeTemplate({ polygon: [{ x: 0, y: 0 }] }),
        []
      )
      expect(result.polygon).toBe(pts)
    })

    it('every optional instance field overrides the template', () => {
      const instance = makeInstance({
        properties: [{ name: 'hp', type: 'int', value: 5 }],
        text: { text: 'hi' },
        polyline: [{ x: 1, y: 1 }],
        ellipse: true,
        point: true
      })
      const result = mergeTemplate(
        instance,
        makeTemplate({
          properties: [{ name: 'hp', type: 'int', value: 1 }],
          text: { text: 'template' },
          polyline: [{ x: 9, y: 9 }]
        }),
        []
      )
      expect(result.properties).toEqual(instance.properties)
      expect(result.text).toBe(instance.text)
      expect(result.polyline).toBe(instance.polyline)
      expect(result.ellipse).toBe(true)
      expect(result.point).toBe(true)
    })

    it('template shape and extras apply when the instance leaves them unset', () => {
      const template = makeTemplate({
        properties: [{ name: 'hp', type: 'int', value: 1 }],
        text: { text: 'template' },
        ellipse: true
      })
      const result = mergeTemplate(makeInstance(), template, [])
      expect(result.properties).toEqual(template.object.properties)
      expect(result.text).toBe(template.object.text)
      expect(result.ellipse).toBe(true)
    })

    it('merges custom properties by name, the instance winning', () => {
      const result = mergeTemplate(
        makeInstance({
          properties: [
            { name: 'b', type: 'string', value: 'B2' },
            { name: 'c', type: 'int', value: 3 }
          ]
        }),
        makeTemplate({
          properties: [
            { name: 'a', type: 'string', value: 'A' },
            { name: 'b', type: 'string', value: 'B' }
          ]
        }),
        []
      )
      expect(result.properties).toEqual([
        { name: 'a', type: 'string', value: 'A' },
        { name: 'b', type: 'string', value: 'B2' },
        { name: 'c', type: 'int', value: 3 }
      ])
    })

    it('an instance shape replaces the whole template shape', () => {
      const polygon = [
        { x: 0, y: 0 },
        { x: 8, y: 0 },
        { x: 8, y: 8 }
      ]
      const result = mergeTemplate(makeInstance({ polygon }), makeTemplate({ ellipse: true }), [])
      expect(result.polygon).toBe(polygon)
      expect(result.ellipse).toBeUndefined()
    })
  })

  describe('GID remapping', () => {
    it('no GID on merged object -no tile field set', () => {
      const result = mergeTemplate(makeInstance(), makeTemplate({}), [])
      expect(result.gid).toBeUndefined()
    })

    it('GID from template, no tileset on template -GID unchanged', () => {
      const result = mergeTemplate(makeInstance(), makeTemplate({ gid: 3 }), [])
      expect(result.gid).toBe(3)
    })

    it('GID from template, template tileset has no source -GID unchanged', () => {
      const tpl = makeTemplate({ gid: 3 })
      tpl.tileset = {
        firstgid: 1,
        name: 'inline',
        tilewidth: 16,
        tileheight: 16,
        columns: 4,
        tilecount: 16,
        margin: 0,
        spacing: 0
      }
      const result = mergeTemplate(makeInstance(), tpl, [makeTileset(100, 'tiles.tsx')])
      expect(result.gid).toBe(3)
    })

    it('GID from template, template tileset source not found in map -GID unchanged', () => {
      const result = mergeTemplate(
        makeInstance(),
        makeTemplate({ gid: 3 }, { firstgid: 1, source: 'other.tsx' }),
        [makeTileset(100, 'tiles.tsx')]
      )
      expect(result.gid).toBe(3)
    })

    it('GID from template remapped to map firstgid space when source matches', () => {
      // template: firstgid=1, gid=3 → localId=2
      // map tileset: firstgid=100, source='tiles.tsx'
      // expected: 100 + 2 = 102
      const result = mergeTemplate(
        makeInstance(),
        makeTemplate({ gid: 3 }, { firstgid: 1, source: 'tiles.tsx' }),
        [makeTileset(100, 'tiles.tsx')]
      )
      expect(result.gid).toBe(102)
    })

    it('GID from instance is already in map space and is not remapped', () => {
      const result = mergeTemplate(
        makeInstance({ gid: 102 }),
        makeTemplate({ gid: 3 }, { firstgid: 1, source: 'tiles.tsx' }),
        [makeTileset(100, 'tiles.tsx')]
      )
      expect(result.gid).toBe(102)
    })

    it('remapping preserves flip bits in high nibble', () => {
      const rawGid = 3 | FLIPPED_HORIZONTALLY_FLAG | FLIPPED_VERTICALLY_FLAG
      const result = mergeTemplate(
        makeInstance(),
        makeTemplate({ gid: rawGid }, { firstgid: 1, source: 'tiles.tsx' }),
        [makeTileset(100, 'tiles.tsx')]
      )
      // localId = 2, remapped = 102, flip bits preserved
      expect(result.gid).toBe(102 | FLIPPED_HORIZONTALLY_FLAG | FLIPPED_VERTICALLY_FLAG)
    })

    it('localId < 0 skips remapping (GID below templateFirstgid)', () => {
      // gid=0 masked = 0 but decodeGid returns null for 0; test with firstgid=5, gid=3
      const result = mergeTemplate(
        makeInstance(),
        makeTemplate({ gid: 3 }, { firstgid: 5, source: 'tiles.tsx' }),
        [makeTileset(100, 'tiles.tsx')]
      )
      // localId = 3 - 5 = -2, skip → gid unchanged
      expect(result.gid).toBe(3)
    })

    it('matches a tileset source regardless of ./ and .. spelling', () => {
      const result = mergeTemplate(
        makeInstance(),
        makeTemplate({ gid: 3 }, { firstgid: 1, source: 'tilesets/a.tsx' }),
        [makeTileset(100, './tilesets/../tilesets/a.tsx')]
      )
      expect(result.gid).toBe(102)
    })

    it('resolves a template tileset source relative to the template path', () => {
      // A caller of parseMap passes the template as read from disk, so its
      // tileset source is still relative to templates/.
      const result = mergeTemplate(
        makeInstance(),
        makeTemplate({ gid: 3 }, { firstgid: 1, source: '../tilesets/a.tsx' }),
        [makeTileset(100, 'tilesets/a.tsx')],
        'templates/enemy.tx'
      )
      expect(result.gid).toBe(102)
    })

    it('uses first matching tileset when map has multiple tilesets', () => {
      const result = mergeTemplate(
        makeInstance(),
        makeTemplate({ gid: 2 }, { firstgid: 1, source: 'b.tsx' }),
        [makeTileset(10, 'a.tsx'), makeTileset(200, 'b.tsx')]
      )
      // localId = 2 - 1 = 1, remapped = 200 + 1 = 201
      expect(result.gid).toBe(201)
    })
  })
})
