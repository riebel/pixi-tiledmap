function positionTile( tile, options ) {
	tile.width = options.width;
	tile.height = options.height;

	if ( options.flippedHorizontally || options.flippedDiagonally ) {
		tile.scale.x = -1;
		tile.anchor.x = 1;
	}

	if ( options.flippedVertically || options.flippedDiagonally ) {
		tile.scale.y = -1;
		tile.anchor.y = 1;
	}
}

var Tile = function ( options ) {
	PIXI.Container.call( this );

	this.gid = options.gid;
	this.animation = false;
	this.sprite = false;

	if (options.textures.length > 0) {
		this.animation = new PIXI.extras.MovieClip( options.textures );

		positionTile( this.animation, options );
		this.animation.animationSpeed = (1000 / 60) / options.duration;
		this.animation.play();
		this.addChild( this.animation );
	}
	else {
		this.sprite = new PIXI.Sprite( options.texture );
		positionTile( this.sprite, options );
		this.addChild( this.sprite );
	}
};

Tile.prototype = Object.create( PIXI.Container.prototype );

module.exports = PIXI.extras.Tile = Tile;