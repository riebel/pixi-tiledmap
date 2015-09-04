var PIXI = require("pixi.js");

var Tile = function ( options ) {
	PIXI.Container.call( this );

	this.gid = options.gid;
	this.flippedVertically = options.flippedVertically;
	this.flippedHorizontally = options.flippedHorizontally;
	this.flippedDiagonally = options.flippedDiagonally;

	var tile = new PIXI.Sprite( options.texture );;

	if (options.textures.length > 0) {
		tile = new PIXI.extras.MovieClip( options.textures );
		tile.animationSpeed = (1000 / 60) / options.duration;
		tile.play();
	}

	tile.width = options.width;
	tile.height = options.height;

	this.addChild( tile );

	if ( this.flippedHorizontally || this.flippedDiagonally ) {
		tile.scale.x = -1;
		tile.anchor.x = 1;
	}

	if ( this.flippedVertically || this.flippedDiagonally ) {
		tile.scale.y = -1;
		tile.anchor.y = 1;
	}
};

Tile.prototype = Object.create( PIXI.Container.prototype );

module.exports = PIXI.extras.Tile = Tile;