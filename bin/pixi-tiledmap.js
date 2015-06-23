(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var tiledMapLoader = require("./src/tiledMapLoader");
PIXI.loaders.Loader.addPixiMiddleware(tiledMapLoader);
PIXI.loader.use(tiledMapLoader());
module.exports = PIXI.extras.TiledMap = require("./src/TiledMap");
},{"./src/TiledMap":5,"./src/tiledMapLoader":6}],2:[function(require,module,exports){
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
					gid: gid,
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
},{"./Tile":3}],3:[function(require,module,exports){
/**
 * Tile
 * @constructor
 */
var Tile = function ( options ) {
	PIXI.Sprite.call( this, options.texture );

	this.gid = options.gid;

	this.width = options.width;
	this.height = options.height;

	this.flippedVertically = options.flippedVertically;
	this.flippedHorizontally = options.flippedHorizontally;
	this.flippedDiagonally = options.flippedDiagonally;

	if (this.flippedHorizontally) {
		this.scale.x = -1;
		this.anchor.x = 1;
	}

	if (this.flippedVertically) {
		this.scale.y = -1;
		this.anchor.y = 1;
	}

	if (this.flippedDiagonally) {
		this.scale.x = -1;
		this.anchor.x = 1;
		this.scale.y = -1;
		this.anchor.y = 1;
	}
};

Tile.prototype = Object.create( PIXI.Sprite.prototype );

module.exports = PIXI.extras.Tile = Tile;
},{}],4:[function(require,module,exports){
/**
 * Tileset
 * @constructor
 */
var Tileset = function ( options ) {

	this.baseTexture = PIXI.Texture.fromImage( options.image );
	this.name = options.name;
	this.firstGID = options.firstgid;
	this.imageHeight = options.imageheight;
	this.imageWidth = options.imagewidth;
	this.tileHeight = options.tileheight;
	this.tileWidth = options.tilewidth;
	this.margin = options.margin;
	this.spacing = options.spacing;
	this.textures = [];

	for ( var y = this.margin; y < this.imageHeight; y += this.tileHeight + this.spacing ) {
		for ( var x = this.margin; x < this.imageWidth; x += this.tileWidth + this.spacing ) {
			this.textures.push( new PIXI.Texture( this.baseTexture, new PIXI.Rectangle( x, y, this.tileWidth, this.tileHeight ) ) );
		}
	}

	//var id,
	//	i,
	//	p,
	//	tile,
	//	shapeData,
	//	shapes,
	//	shape,
	//	points;
	//for (id in tilesetData.tiles) {
	//	tile = tilesetData.tiles[id];
	//	for (i = 0; i < tile.objectgroup.objects.length; i++) {
	//		shapeData = tile.objectgroup.objects[0];
	//		shapes = [];
	//		if (shapeData.polygon) {
	//			points = [];
	//			for (p = 0; p < shapeData.polygon.length; p++) {
	//				points.push(shapeData.polygon[p].x);
	//				points.push(shapeData.polygon[p].y);
	//			}
	//			shape = new PIXI.Polygon(points);
	//		} else if (shapeData.ellipse) {
	//			shape = new PIXI.Circle(shapeData.x, shapeData.y, shapeData.height / 2);
	//		} else {
	//			shape = new PIXI.Rectangle(shapeData.x, shapeData.y, shapeData.width, shapeData.height);
	//		}
	//		shapes.push(shape);
	//	}
	//	tileset.tiles[+id + 1] = {collision: shapes};
	//}

};

module.exports = PIXI.extras.TileSet = Tileset;

},{}],5:[function(require,module,exports){
var TileSet = require( "./TileSet" );
var Layer = require( "./Layer" );

/**
 * TiledMap
 * @constructor
 */
var TiledMap = function ( resourceName ) {
	PIXI.Container.call( this );

	this.layers = [];
	this.tilesets = [];

	var data = PIXI.loader.resources[ resourceName ].data;

	data.tilesets.forEach( function ( tilesetData ) {
		this.tilesets.push( new TileSet( tilesetData ) );
	}, this );

	data.layers.forEach( function ( layerData ) {
		var layer = new Layer( layerData, this.tilesets );
		this.layers[ layerData.name ] = layer;
		this.addLayer( layer );
	}, this );
};

TiledMap.prototype = Object.create( PIXI.Container.prototype );

TiledMap.prototype.addLayer = function ( layer ) {
	this.addChild( layer );
};

TiledMap.prototype.getLayerByName = function ( name ) {
	return this.layers[ name ];
};

TiledMap.prototype.getTilesByGid = function ( gids ) {
	var tiles = [];

	this.layers.forEach( function ( layer ) {
		tiles = tiles.concat( layer.getTilesByGid( gids ) );
	} );

	return tiles;
};

module.exports = TiledMap;
},{"./Layer":2,"./TileSet":4}],6:[function(require,module,exports){
module.exports = function() {
	return function(resource, next) {
		if (!resource.data || !resource.isJson || !resource.data.layers || !resource.data.tilesets) {
			return next();
		}

		var tileSets = resource.data.tilesets;
		for (var i = 0; i < tileSets.length; i++) {
			this.add(tileSets[i].name, tileSets[i].image);
		}
		next();
	};
};

},{}]},{},[1]);
