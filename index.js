var PIXI = require("pixi.js");
var tiledMapLoader = require( "./src/tiledMapLoader" );

PIXI.loaders.Loader.addPixiMiddleware( tiledMapLoader );
PIXI.loader.use( tiledMapLoader() );

module.exports = PIXI.extras.TiledMap = require( "./src/TiledMap" );