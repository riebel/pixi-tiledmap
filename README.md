# pixi-tiledmap [![NPM version][npm-image]][npm-url]

Use [Tiled](http://www.mapeditor.org/) maps with PIXI v3.

Uses the loader middleware to load Tiled TMX maps. 

Creates a new PIXI class PIXI.extras.TiledMap which is an extended PIXI.Container() containing all layers and tiles.

## Installation

```sh
npm install pixi-tiledmap
```

or

```sh
jspm install pixi-tiledmap
```

## Usage

```js
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

## Changelog

1.4.0 Switched from JSON to TMX as input format

1.4.5 Added support for animated tiles

1.5.0 Mayor code refactoring. TileMap now has all properties of the TMX object.

1.5.1 Fixed crash if layer is not of type tile

[npm-url]: https://npmjs.org/package/pixi-tiledmap
[npm-image]: http://img.shields.io/npm/v/pixi-tiledmap.svg?style=flat