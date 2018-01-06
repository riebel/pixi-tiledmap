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

or include `pixi-tiledmap.min.js` after pixi.js in your html file.

## Usage

```js
/**
 * optional require of pixi.js and pixi-tiledmap
 */
var PIXI = require('pixi.js');
var pixiTiled = require('pixi-tiledmap');

var renderer = PIXI.autoDetectRenderer( 1024, 768 );
document.body.appendChild( renderer.view );

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
        var tileMap = new PIXI.extras.TiledMap( "map.tmx" );
        renderer.render( tileMap );
    }
);
```

or

```js
/**
 * optional require of pixi.js and pixi-tiledmap
 */
var PIXI = require('pixi.js');
var pixiTiled = require('pixi-tiledmap');

var renderer = PIXI.autoDetectRenderer( 1024, 768 );
document.body.appendChild( renderer.view );

/**
* Alternatively, an alias can be used in order to identify loaded map.
*/
PIXI.loader
    .add("myMap", "path/to/myMap.tmx")
    .load( function () {
        /**
        *   PIXI.extras.TiledMap() is an extended PIXI.Container()
        *   so you can render it right away
        */
        var tileMap = new PIXI.extras.TiledMap( "myMap" );
        renderer.render( tileMap );
    }
);
```


An example implementation with webpack can be found under example/

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
