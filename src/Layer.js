/* */

var Tile = require( "./Tile" );
function findTexture ( gid, tilesets ) {
	var tileset,
		i,
		ix;
	for ( i = tilesets.length - 1; i >= 0; i-- ) {
		tileset = tilesets[ i ];
		if ( tileset.firstGID <= gid ) {
			break;
		}
	}
	ix = gid - tileset.firstGID;
	return tileset.textures[ ix ];
}
var Layer = function ( options, tilesets ) {
	PIXI.Container.call( this );
	this.name = options.name;
	this.alpha = options.alpha || 1;
	this.data = options.data;
	this.tilesets = tilesets;
	this.tiles = [];
	this.createTiles( options, tilesets );
};
Layer.prototype = Object.create( PIXI.Container.prototype );
Layer.prototype.createTiles = function ( options, tilesets ) {
	// Bits on the far end of the 32-bit global tile ID are used for tile flags
	var FLIPPED_HORIZONTALLY_FLAG = 0x80000000,
		FLIPPED_VERTICALLY_FLAG = 0x40000000,
		FLIPPED_DIAGONALLY_FLAG = 0x20000000,
		x,
		y,
		i,
		gid,
		tile;

	for ( y = 0; y < options.height; y++ ) {
		for ( x = 0; x < options.width; x++ ) {
			i = x + (y * options.width);

			gid = options.data[ i ];

			// Read out the flags
			var flippedHorizontally = Boolean( gid & FLIPPED_HORIZONTALLY_FLAG );
			var flippedVertically = Boolean( gid & FLIPPED_VERTICALLY_FLAG );
			var flippedDiagonally = Boolean( gid & FLIPPED_DIAGONALLY_FLAG );

			// Clear the flags
			gid &= ~(FLIPPED_HORIZONTALLY_FLAG | FLIPPED_VERTICALLY_FLAG | FLIPPED_DIAGONALLY_FLAG);

			var texture = findTexture( gid, tilesets );

			if ( gid !== 0 && texture ) {
				tile = new Tile( {
					gid: options.data[ i ],
					texture: texture,
					width: texture.width,
					height: texture.height,
					flippedHorizontally: flippedHorizontally,
					flippedVertically: flippedVertically,
					flippedDiagonally: flippedDiagonally
				} );
				tile.x = x * texture.width;
				tile.y = y * texture.height;
				this.tiles.push( tile );
				this.addTile( tile );
			}
		}
	}
};
Layer.prototype.addTile = function ( tile ) {
	this.addChild( tile );
};
Layer.prototype.getTilesByGid = function ( gids ) {
	if ( !Array.isArray( gids ) ) {
		gids = [ gids ];
	}
	return this.children.filter( function ( tile ) {
		return gids.indexOf( tile.gid ) > -1;
	} );
};
module.exports = PIXI.extras.TileLayer = Layer;