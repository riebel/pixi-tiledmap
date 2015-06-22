/**
 * Tile
 * @constructor
 */
var Tile = function ( options ) {
	PIXI.Sprite.call( this, options.texture );

	this.gid = options.gid;

	this.width = options.width;
	this.height = options.height;
};

Tile.prototype = Object.create( PIXI.Sprite.prototype );

module.exports = PIXI.extras.Tile = Tile;