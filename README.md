# pixi-tiledmap [![NPM version][npm-image]][npm-url]

Use [Tiled Map Editor](http://www.mapeditor.org/) maps with [pixi.js](https://www.npmjs.com/package/pixi.js).

pixi-tiledmap is a Pixi loader middleware which loads Tiled Map Editor 
[TMX maps](http://doc.mapeditor.org/reference/tmx-map-format/) and parses them with 
[node-tmx-parser](https://www.npmjs.com/package/tmx-parser). It exports a pixi.js class `PIXI.extras.TiledMap` 
which is an extended `PIXI.Container` containing all layers of the tile map as an instance of `PIXI.Container` and all 
tiles within as an instance of `PIXI.extras.AnimatedSprite`.

## Installation

```sh
npm install pixi-tiledmap
```

or

```sh
yarn add pixi-tiledmap
```

or include `pixi-tiledmap.min.js` after pixi.js in your html file (See [`example/browser`](https://github.com/riebel/pixi-tiledmap/tree/master/example/browser) for an example).

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>pixi-tiledmap example</title>
</head>
<body>
<script type="text/javascript" src="https://pixijs.download/v4.8.7/pixi.min.js"></script>
<script type="text/javascript" src="pixi-tiledmap.min.js"></script>
<script>
    (function() {
        const renderer = PIXI.autoDetectRenderer(442, 286);
        document.body.appendChild(renderer.view);

        /**
         * Simply load a Tiled map in TMX format like a usual resource
         */
        PIXI.loader
            .add('assets/01_basement.tmx')
            .load(function () {
                    /**
                     *   PIXI.extras.TiledMap() is an extended PIXI.Container()
                     *   so you can render it right away
                     */
                    let tileMap = new PIXI.extras.TiledMap('assets/01_basement.tmx');
                    renderer.render(tileMap);
                }
            );
    })();
</script>
</body>
</html>
```

## Usage

```js
var PIXI = require('pixi.js');
require('pixi-tiledmap');

var renderer = PIXI.autoDetectRenderer(1024, 768);
document.body.appendChild(renderer.view);

/**
 * Simply load a Tiled map in TMX format like a usual resource
 */
PIXI.loader
    .add('map.tmx')
    .load( function () {
        /**
        *   PIXI.extras.TiledMap() is an extended PIXI.Container()
        *   so you can render it right away
        */
        renderer.render(new PIXI.extras.TiledMap("map.tmx"));
    }
    /**
        //Alternatively, an alias can be used in order to identify loaded map.
         
        .add("myMap", "path/to/myMap.tmx")
        .load( function () {
              renderer.render(new PIXI.extras.TiledMap("myMap"));
        }
    */
);
```

ES6
```js
import * as PIXI from 'pixi.js';
import 'pixi-tiledmap';

const renderer = PIXI.autoDetectRenderer(442, 286);
document.body.appendChild(renderer.view);

/**
 * Simply load a Tiled map in TMX format like a usual resource
 */
PIXI.loader
    .add('assets/01_basement.tmx')
    .load(() => {
        /**
         *   PIXI.extras.TiledMap() is an extended PIXI.Container()
         *   so you can render it right away
         */
        renderer.render(new PIXI.extras.TiledMap('assets/01_basement.tmx'));
    });
```

For the browser examples in `examples/browser/` run `yarn` and `yarn start` to start a `devServer` on Port 3000.
For the webpack examples in `examples/webpack/` run `yarn` and `yarn start` inside of `examples/webpack/` to start a `devServer` on Port 3000.

Open [http://localhost:3000/](http://localhost:3000/) in your browser.

## Documentation

Documentation available in `docs/`. You can read it online [here](http://htmlpreview.github.io/?https://github.com/riebel/pixi-tiledmap/blob/master/docs/index.html)

Example TiledMap object

```js
{
    TiledMap {_events: Events, _eventsCount: 0, tempDisplayObjectParent: DisplayObject, transform: TransformStatic, alpha: 1, …}
        alpha: 1
        background: Graphics {_events: Events, _eventsCount: 0, tempDisplayObjectParent: null, transform: TransformStatic, alpha: 1, …}
        backgroundColor: undefined
        buttonMode: (...)
        children: (2) [Graphics, TileLayer]
        filterArea: null
        layers: Array(1)
            0: TileLayer
                diagonalFlips: (187) [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, …]
                horizontalFlips: (187) [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, …]
                map: Map {version: "1.0", orientation: "orthogonal", width: 17, height: 11, tileWidth: 26, …}
                name: "meta"
                opacity: 0.2
                properties: {}
                tiles: (283) [Tile, Tile, Tile, Tile, Tile, Tile, Tile, Tile, Tile, Tile, Tile, Tile, Tile, Tile, Tile, Tile, Tile, Tile, Tile, Tile, Tile, Tile, Tile, Tile, Tile, Tile, Tile, Tile, Tile, Tile, Tile, Tile, Tile, Tile, Tile, Tile, 49: Tile, 50: Tile, 51: Tile, 52: Tile, 66: Tile, 67: Tile, 68: Tile, 69: Tile, 83: Tile, 84: Tile, 85: Tile, 86: Tile, 100: Tile, 101: Tile, 102: Tile, 103: Tile, 117: Tile, 118: Tile, 119: Tile, 120: Tile, 134: Tile, 135: Tile, 136: Tile, 137: Tile, 151: Tile, 152: Tile, 153: Tile, 154: Tile, 155: Tile, 156: Tile, 157: Tile, 158: Tile, 159: Tile, 160: Tile, 161: Tile, 162: Tile, 163: Tile, 164: Tile, 165: Tile, 166: Tile, 167: Tile, 168: Tile, 169: Tile, 170: Tile, 171: Tile, 172: Tile, 173: Tile, 174: Tile, 175: Tile, 176: Tile, 177: Tile, 178: Tile, 179: Tile, 180: Tile, 181: Tile, 182: Tile, 183: Tile, 184: Tile, 185: Tile, 186: Tile, 187: Tile, 188: Tile, 189: Tile, 190: Tile, …]
                type: "tile"
                verticalFlips: (187) [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, …]
                visible: true
                __proto__: Object
            meta: TileLayer {_events: Events, _eventsCount: 0, tempDisplayObjectParent: null, transform: TransformStatic, alpha: 0.2, …}
            length: 1
            __proto__: Array(0)
        orientation: "orthogonal"
        parent: null
        properties: {}
        renderable: true
        resourceUrl: "assets/01_basement.tmx"
        tempDisplayObjectParent: DisplayObject {_events: Events, _eventsCount: 0, tempDisplayObjectParent: null, transform: TransformStatic, alpha: 1, …}
        tileHeight: 26
        tileSets: Array(2)
        0: TileSet
        firstGid: 1
        image: Image {format: undefined, source: "meta.png", trans: undefined, width: 52, height: 26}
        margin: null
        name: "meta"
        properties: {}
        source: undefined
        spacing: null
        terrainTypes: []
        tileHeight: 26
        tileOffset: {x: 0, y: 0}
        tileWidth: 26
        tiles: Array(2)
            0: Tile
                animations: []
                gid: 1
                id: 0
                image: null
                objectGroups: []
                probability: null
                properties: {}
                terrain: []
                __proto__: Object
            1: Tile {id: 1, terrain: Array(0), probability: null, properties: {…}, animations: Array(0), …}
            length: 2
            __proto__: Array(0)
        __proto__: Object
        1: TileSet {firstGid: 1, baseTexture: Texture, textures: Array(2), margin: null, spacing: null, …}
        length: 2
        __proto__: Array(0)
        tileWidth: 26
        trackedPointers: (...)
        transform: TransformStatic {worldTransform: Matrix, localTransform: Matrix, _worldID: 0, _parentID: 0, position: ObservablePoint, …}
        version: "1.0"
        visible: true
        worldAlpha: 1
        _bounds: Bounds {minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity, rect: null, …}
        _boundsID: 5
        _boundsRect: null
        _destroyed: false
        _enabledFilters: null
        _events: Events {}
        _eventsCount: 0
        _filters: null
        _height: 11
        _lastBoundsID: 2
        _localBoundsRect: Rectangle {x: 0, y: 0, width: 0, height: 0, type: 1}
        _mask: null
        _width: 17
        cacheAsBitmap: (...)
        filters: (...)
        height: (...)
        localTransform: (...)
        mask: (...)
        pivot: (...)
        position: (...)
        rotation: (...)
        scale: (...)
        skew: (...)
        width: (...)
        worldTransform: (...)
        worldVisible: (...)
        x: (...)
        y: (...)
        _tempDisplayObjectParent: (...)
        __proto__: Container
}
```

## To do

support isometric and hexagonal orientation

[npm-url]: https://npmjs.org/package/pixi-tiledmap
[npm-image]: http://img.shields.io/npm/v/pixi-tiledmap.svg?style=flat
