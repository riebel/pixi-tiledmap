# pixi-tiledmap [![NPM version][npm-image]][npm-url]

Use [Tiled](http://www.mapeditor.org/) maps with PIXI v3.

Uses the loader middleware to load Tiled json maps. 
Creates new PIXI classes for Tiled maps.

## installation

```sh
npm install pixi-tiledmap
```

or

```sh
jspm install pixi-tiledmap
```

## usage

```js
var PIXI = require('pixi.js');
var pixiTiled = require('pixi-tiledmap');

var renderer = PIXI.autoDetectRenderer( 1024, 768 );
document.body.appendChild( renderer.view );

/**
 * Simply load a Tiled map in json format like a usual resource
 */
PIXI.loader
    .add('map.json')
    .load( function () {
        /**
        *   PIXI.extras.TiledMap() is an extended PIXI.Container()
        *   so you can render it right away
        */
        var tileMap = new PIXI.extras.TiledMap( "map.json" );
        renderer.render( tileMap );
    }
);
```

[npm-url]: https://npmjs.org/package/pixi-tiledmap
[npm-image]: http://img.shields.io/npm/v/pixi-tiledmap.svg?style=flat