var PIXI = require("pixi.js");
var Tile = require( "./Tile" );

function findTileset ( gid, tilesets ) {
	var tileset;
	for ( var i = tilesets.length - 1; i >= 0; i-- ) {
		tileset = tilesets[ i ];
		if ( tileset.firstGID <= gid ) {
			break;
		}
	}
	return tileset;
}

var Layer = function ( tileWidth, tileHeight, layer, tilesets ) {
	PIXI.Container.call( this );
	this.name = layer.name;
	this.visible = layer.visible;
	this.alpha = parseFloat(layer.opacity);
	this.tilesets = tilesets;
	this.tiles = [];

	var i,
		tile,
		duration= 1,
		gid,
		tileset,
		texture,
		textures;

	for ( var y = 0; y < layer.map.height; y++ ) {
		for ( var x = 0; x < layer.map.width; x++ ) {
			i = x + (y * layer.map.width);

			gid = layer.tiles[ i ] ? layer.tiles[ i ].gid : 0;
			tileset = findTileset( gid, tilesets );
			texture = tileset.textures[ gid - tileset.firstGID ];
			textures = [];

			if ( gid !== 0 && texture ) {
				layer.tiles[ i ].animations.forEach( function ( frame ) {
					duration = frame.duration;
					textures.push(tileset.textures[ parseInt(frame.tileId) ]);
				});

				tile = new Tile( {
					gid: gid,
					textures: textures,
					duration: duration,
					texture: texture,
					width: texture.width,
					height: texture.height,
					flippedHorizontally: layer.horizontalFlips[i],
					flippedVertically: layer.verticalFlips[i],
					flippedDiagonally: layer.diagonalFlips[i]
				} );

				tile.x = x * tileWidth;
				tile.y = y * tileHeight + ( tileHeight - texture.height );

				if ( tileset.tileOffset ) {
					tile.x += tileset.tileOffset.x;
					tile.y += tileset.tileOffset.y;
				}

				this.tiles.push( tile );
				this.addTile( tile );
			}
		}
	}
};

Layer.prototype = Object.create( PIXI.Container.prototype );

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