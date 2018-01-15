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
<script type="text/javascript" src="https://pixijs.download/v4.6.2/pixi.min.js"></script>
<script type="text/javascript" src="pixi-tiledmap.min.js"></script>
<script>
    var renderer = PIXI.autoDetectRenderer(442, 286);
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
                var tileMap = new PIXI.extras.TiledMap('assets/01_basement.tmx');
                renderer.render(tileMap);
            }
        );
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

An example implementation with webpack can be found under `example/webpack`.

For the browser example run `npm install` and `npm run example` to start a `http-server` on Port 8080.
Open [http://localhost:8080/](http://localhost:8080/) in your browser.

## Documentation

Example TiledMap object

```js
{
    alpha: 1
    backgroundColor: undefined
    cacheAsBitmap: (...)
    children: Array[3]
        0: ImageLayer
            alpha: 1
            cacheAsBitmap: (...)
            children: Array[1]
            filterArea: null
            filters: (...)
            height: (...)
            image: Image
            mask: (...)
            name: "background"
            opacity: 1
            parent: TiledMap
            pivot: Point
            position: Point
            properties: Object
            renderable: true
            rotation: 0
            scale: Point
            type: "image"
            visible: true
            width: (...)
            worldAlpha: 1
            worldTransform: Matrix
            worldVisible: (...)
            x: (...)
            y: (...)
        1: TileLayer
        2: TileLayer
            alpha: 1
            cacheAsBitmap: (...)
            children: Array[4]
            diagonalFlips: Array[187]
            filterArea: null
            filters: (...)
            height: (...)
            horizontalFlips: Array[187]
            map: Map
            mask: null
            name: "fire"
            opacity: 1
            parent: TiledMap
            pivot: Point
            position: Point
            properties: Object
            renderable: true
            rotation: 0
            scale: Point
            tiles: Array[4]
                0: Tile
                    alpha: 1
                    anchor: Point
                    animation: undefined
                    animationSpeed: 0.16666666666666669
                    animations: Array[6]
                    blendMode: 0
                    cacheAsBitmap: (...)
                    cachedTint: 16777215
                    children: Array[0]
                    currentFrame: (...)
                    filterArea: null
                    filters: (...)
                    gid: 33
                    height: (...)
                    id: 0
                    image: null
                    loop: true
                    mask: (...)
                    onComplete: null
                    parent: TileLayer
                    pivot: Point
                    playing: true
                    position: Point
                    probability: null
                    properties: Object
                    renderable: true
                    rotation: 0
                    scale: Point
                    shader: null
                    terrain: Array[0]
                    texture: (...)
                    textures: (...)
                    tint: 16777215
                    totalFrames: (...)
                    visible: true
                    width: (...)
                    worldAlpha: 1
                    worldTransform: Matrix
                    worldVisible: (...)
                    x: (...)
                    y: (...)
                1: Tile
                2: Tile
                3: Tile
            type: "tile"
            verticalFlips: Array[187]
            visible: true
            width: (...)
            worldAlpha: 1
            worldTransform: Matrix
            worldVisible: (...)
            x: (...)
            y: (...)
    filterArea: null
    filters: (...)
    height: (...)
    layers: Array[0]
    mask: (...)
    orientation: "orthogonal"
    parent: Container
    pivot: Point
    position: Point
    properties: Object
    renderable: true
    rotation: 0
    scale: Point
    tileHeight: 26
    tileSets: Array[2]
    tileWidth: 26
    version: "1.0"
    visible: true
    width: (...)
    worldAlpha: 1
    worldTransform: Matrix
    worldVisible: (...)
    x: (...)
    y: (...)
}
```

## To do

support isometric and hexagonal orientation

[npm-url]: https://npmjs.org/package/pixi-tiledmap
[npm-image]: http://img.shields.io/npm/v/pixi-tiledmap.svg?style=flat
