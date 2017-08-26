var PIXI = require('pixi.js');
var pixiTiled = require('pixi-tiledmap');

var renderer = PIXI.autoDetectRenderer( 442, 286 );
document.body.appendChild( renderer.view );

/**
 * Simply load a Tiled map in TMX format like a usual resource
 */
PIXI.loader
    .add('assets/01_basement.tmx')
    .load( function () {
            /**
             *   PIXI.extras.TiledMap() is an extended PIXI.Container()
             *   so you can render it right away
             */
            var tileMap = new PIXI.extras.TiledMap( "assets/01_basement.tmx" );
            renderer.render( tileMap );
        }
    );