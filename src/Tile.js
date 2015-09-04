var PIXI = require("pixi.js");
var Tile = function ( options ) {
	PIXI.Sprite.call( this, options.texture );

	this.gid = options.gid;
	this.width = options.width;
	this.height = options.height;

	this.flippedVertically = options.flippedVertically;
	this.flippedHorizontally = options.flippedHorizontally;
	this.flippedDiagonally = options.flippedDiagonally;

	if ( this.flippedHorizontally || this.flippedDiagonally ) {
		this.scale.x = -1;
		this.anchor.x = 1;
	}

	if ( this.flippedVertically || this.flippedDiagonally ) {
		this.scale.y = -1;
		this.anchor.y = 1;
	}
};

Tile.prototype = Object.create( PIXI.Sprite.prototype );

module.exports = PIXI.extras.Tile = Tile;