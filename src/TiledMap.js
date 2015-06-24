var TileSet = require( "./TileSet" );
var Layer = require( "./Layer" );

var TiledMap = function ( resourceName ) {
	PIXI.Container.call( this );

	this.layers = [];
	this.tilesets = [];

	var data = PIXI.loader.resources[ resourceName ].data;

	data.tilesets.forEach( function ( tilesetData ) {
		this.tilesets.push( new TileSet( tilesetData ) );
	}, this );

	data.layers.forEach( function ( layerData ) {
		var layer = new Layer( data.tilewidth, data.tileheight, layerData, this.tilesets );
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