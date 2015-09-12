# pixi-tiledmap [![NPM version][npm-image]][npm-url]

Use [Tiled](http://www.mapeditor.org/) maps with PIXI v3.

Uses the loader middleware to load Tiled [TMX maps](http://doc.mapeditor.org/reference/tmx-map-format/) and parsing them with [node-tmx-parser](https://www.npmjs.com/package/tmx-parser). 

Creates a new PIXI class PIXI.extras.TiledMap which is an extended PIXI.Container containing
all layers (as PIXI.Container) and tiles (as PIXI.extras.MovieClip).

## Installation

```sh
npm install pixi-tiledmap
```

or

```sh
jspm install pixi-tiledmap
```

or include pixi-tiledmap.min.js after pixi.js in your html file.

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

## Changelog

1.6.0 internal API changes

1.5.1 Fixed crash if layer is not of type tile

1.5.0 TileMap now has all properties of the TMX object.

1.4.5 Added support for animated tiles

1.4.0 Switched from JSON to TMX as input format

[npm-url]: https://npmjs.org/package/pixi-tiledmap
[npm-image]: http://img.shields.io/npm/v/pixi-tiledmap.svg?style=flat