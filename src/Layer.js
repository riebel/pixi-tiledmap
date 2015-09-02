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

function decodeBase64AsArray(input) {
	var bytes = 4;

	input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

	var dec = new Buffer(input, 'base64'), i, j, len;
	var ar = new Uint32Array(dec.length / bytes);

	for (i = 0, len = dec.length / bytes; i < len; i++) {
		ar[i] = 0;
		for (j = bytes - 1; j >= 0; --j) {
			ar[i] += dec[(i * bytes) + j] << (j << 3);
		}
	}
	 //console.log(JSON.stringify(ar));
	return ar;
}

var Layer = function ( tileWidth, tileHeight, layerData, tilesets ) {


	// Decode base64 (convert ascii to binary)
	//var strData     = atob(layerData.data[0]._);

// Convert binary string to character-number array
//	var charData    = strData.split('').map(function(x){return x.charCodeAt(0);});

// Turn number array into byte-array
//	var binData     = new Uint8Array(charData);

// Pako magic
//	var data        = pako.inflate(strData);



	//var zipped = new buffer.Buffer(layerData.data[0]._.trim(), 'base64');
	var data = decodeBase64AsArray(layerData.data[0]._.trim());

	//var compressData = atob(layerData.data[0]._);
	//console.log(zipped);
	//var compressData = compressData.split('').map(function(e) {
	//	return e.charCodeAt(0);
	//});
	//var data = zlib.Inflate(zipped);
	//zipped.readUInt32LE(1);
	//zlib.inflate(zipped, function(err, buffer) {
	//	console.log(buffer.readUInt32LE(2));
	//});
	//console.log( data );
	//var data = inflate.decompress();
//// Convert gunzipped byteArray back to ascii string:
//	var strData     = String.fromCharCode.apply(null, new Uint16Array(data));

// Output to console


	PIXI.Container.call( this );
	this.name = layerData.$.name;
	this.visible = (typeof layerData.$.visible != "undefined") ? (layerData.$.visible != 0) ? layerData.$.visible : false : true;
	this.alpha = parseInt(layerData.$.opacity) || 1;
	this.data = data;
	this.tilesets = tilesets;
	this.tiles = [];
	// Bits on the far end of the 32-bit global tile ID are used for tile flags
	var FLIPPED_HORIZONTALLY_FLAG = 0x80000000,
		FLIPPED_VERTICALLY_FLAG = 0x40000000,
		FLIPPED_DIAGONALLY_FLAG = 0x20000000,
		x,
		y,
		i,
		gid,
		tile;

	for ( y = 0; y < layerData.$.height; y++ ) {
		for ( x = 0; x < layerData.$.width; x++ ) {
			i = x + (y * layerData.$.width);

			gid = data[ i ];

			// Read out the flags
			var flippedHorizontally = Boolean( gid & FLIPPED_HORIZONTALLY_FLAG );
			var flippedVertically = Boolean( gid & FLIPPED_VERTICALLY_FLAG );
			var flippedDiagonally = Boolean( gid & FLIPPED_DIAGONALLY_FLAG );

			// Clear the flags
			gid &= ~(FLIPPED_HORIZONTALLY_FLAG | FLIPPED_VERTICALLY_FLAG | FLIPPED_DIAGONALLY_FLAG);

			var tileset = findTileset( gid, tilesets );
			var texture = tileset.textures[ gid - tileset.firstGID ];

			if ( gid !== 0 && texture ) {
				tile = new Tile( {
					gid: data[ i ],
					texture: texture,
					width: texture.width,
					height: texture.height,
					flippedHorizontally: flippedHorizontally,
					flippedVertically: flippedVertically,
					flippedDiagonally: flippedDiagonally
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