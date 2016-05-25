var tiledMapLoader = require('./src/tiledMapLoader');
var PIXI = require('');

PIXI.loaders.Loader.addPixiMiddleware(tiledMapLoader);
PIXI.loader.use(tiledMapLoader());

module.exports = PIXI.extras.TiledMap = require('./src/TiledMap');