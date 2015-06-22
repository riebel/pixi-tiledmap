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

/**
 * Layer
 * @constructor
 */
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
	var x,
		y,
		i,
		gid,
		tile;

	for ( y = 0; y < options.height; y++ ) {
		for ( x = 0; x < options.width; x++ ) {
			i = x + (y * options.width);
			gid = options.data[ i ];
			var texture = findTexture( gid, tilesets );

			if ( gid !== 0 && texture ) {
				tile = new Tile( {
					gid: gid,
					texture: texture,
					width: texture.width,
					height: texture.height
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