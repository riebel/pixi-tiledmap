var Tile = function ( tile ) {

	PIXI.extras.MovieClip.call( this, tile.textures );

	for ( var property in tile ) {
		if ( tile.hasOwnProperty( property ) ) {
			this[ property ] = tile[ property ];
		}
	}
};

Tile.prototype = Object.create( PIXI.extras.MovieClip.prototype );

module.exports = PIXI.extras.Tile = Tile;