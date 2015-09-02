var TileSet = require( "./TileSet" ),
	Layer = require( "./Layer" ),
	path = require( "path" );

var TiledMap = function ( resourceUrl ) {
	PIXI.Container.call( this );

	this.layers = [];
	this.tilesets = [];

	var route = path.dirname( resourceUrl );

	var data = PIXI.loader.resources[ resourceUrl ].data;

	data.map.tileset.forEach( function ( tilesetData ) {
		this.tilesets.push( new TileSet( route, tilesetData ) );
	}, this );

	data.map.layer.forEach( function ( layerData ) {
		var layer = new Layer( data.map.$.tilewidth, data.map.$.tileheight, layerData, this.tilesets );
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