function Tile ( tile, tileSet, horizontalFlip, verticalFlip, diagonalFlip ) {
	var textures = [];

	if ( tile.animations.length ) {
		tile.animations.forEach( function ( frame ) {
			textures.push( tileSet.textures[ frame.tileId ] );
		}, this );
	}
	else {
		textures.push( tileSet.textures[ tile.gid - tileSet.firstGid ] );
	}

	PIXI.extras.MovieClip.call( this, textures );

	for ( var property in tile ) {
		if ( tile.hasOwnProperty( property ) ) {
			this[ property ] = tile[ property ];
		}
	}

	if ( horizontalFlip || diagonalFlip ) {
		this.anchor.x = 1;
		this.scale.x = -1;
	}

	if ( verticalFlip || diagonalFlip ) {
		this.anchor.y = 1;
		this.scale.y = -1;
	}

	this.textures = textures;
	this.tileSet = tileSet;
}

Tile.prototype = Object.create( PIXI.extras.MovieClip.prototype );

module.exports = Tile;