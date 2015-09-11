function Tile ( tile, tileSet ) {
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

	this.textures = textures;
}

Tile.prototype = Object.create( PIXI.extras.MovieClip.prototype );

module.exports = Tile;