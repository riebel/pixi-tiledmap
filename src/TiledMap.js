var TileSet = require( "./TileSet" ),
	Layer = require( "./Layer" ),
	path = require( "path" );

var TiledMap = function ( resourceUrl ) {
	PIXI.Container.call( this );

	this.layers = [];
	this.tileSets = [];

	var route = path.dirname( resourceUrl );

	var data = PIXI.loader.resources[ resourceUrl ].data;

	data.tileSets.forEach( function ( tilesetData ) {
		this.tileSets.push( new TileSet( route, tilesetData ) );
	}, this );

	data.layers.forEach( function ( layerData ) {
		var layer = new Layer( data.tileWidth, data.tileHeight, layerData, this.tileSets );
		this.layers[ layerData.name ] = layer;
		this.addLayer( layer );
	}, this );
};

TiledMap.prototype = Object.create( PIXI.Container.prototype );

TiledMap.prototype.addLayer = function ( layer ) {
	this.addChild( layer );
};

TiledMap.prototype.getTilesByGid = function ( gids ) {
	var tiles = [];

	this.layers.forEach( function ( layer ) {
		tiles = tiles.concat( layer.getTilesByGid( gids ) );
	} );

	return tiles;
};

module.exports = TiledMap;