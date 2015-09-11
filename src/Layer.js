var Tile = require( "./Tile" );

function findTileset ( gid, tilesets ) {
	var tileset;
	for ( var i = tilesets.length - 1; i >= 0; i-- ) {
		tileset = tilesets[ i ];
		if ( tileset.firstGid <= gid ) {
			break;
		}
	}
	return tileset;
}

var Layer = function ( layer, tileSets ) {
	PIXI.Container.call( this );

	for ( var property in layer ) {
		if ( layer.hasOwnProperty( property ) ) {
			this[ property ] = layer[ property ];
		}
	}

	this.alpha = parseFloat( layer.opacity );
	this.tiles = [];

	for ( var y = 0; y < layer.map.height; y++ ) {
		for ( var x = 0; x < layer.map.width; x++ ) {
			var i = x + (y * layer.map.width);

			if ( layer.tiles[ i ] ) {

				if ( layer.tiles[ i ].gid && layer.tiles[ i ].gid !== 0 ) {

					var tileset = findTileset( layer.tiles[ i ].gid, tileSets );
					var tile = new Tile( layer.tiles[ i ], tileset );

					if ( layer.horizontalFlips[ i ] || layer.diagonalFlips[ i ] ) {
						tile.anchor.x = 1;
						tile.scale.x = -1;
					}

					if ( layer.verticalFlips[ i ] || layer.diagonalFlips[ i ] ) {
						tile.anchor.y = 1;
						tile.scale.y = -1;
					}

					tile.x = x * layer.map.tileWidth;
					tile.y = y * layer.map.tileHeight + ( layer.map.tileHeight - tile.textures[ 0 ].height );

					if ( tileset.tileOffset ) {
						tile.x += tileset.tileOffset.x;
						tile.y += tileset.tileOffset.y;
					}

					if ( tile.textures.length > 1 ) {
						tile.animationSpeed = 1000 / 60 / tile.animations[ 0 ].duration;
						tile.gotoAndPlay( 0 );
					}

					this.tiles.push( tile );

					this.addTile( tile );
				}
			}

		}
	}
};

Layer.prototype = Object.create( PIXI.Container.prototype );

Layer.prototype.addTile = function ( tile ) {
	this.addChild( tile );
};

module.exports = Layer;