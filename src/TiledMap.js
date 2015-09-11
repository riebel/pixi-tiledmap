var TileSet = require( "./TileSet" ),
	Layer = require( "./Layer" ),
	path = require( "path" );

function TiledMap( resourceUrl ) {
	PIXI.Container.call( this );

	var route = path.dirname( resourceUrl );
	var data = PIXI.loader.resources[ resourceUrl ].data;

	for ( var property in data ) {
		if ( data.hasOwnProperty( property ) ) {
			this[ property ] = data[ property ];
		}
	}

	this.tileSets = [];
	this.layers = [];

	data.tileSets.forEach( function ( tilesetData ) {
		this.tileSets.push( new TileSet( route, tilesetData ) );
	}, this );

	data.layers.forEach( function ( layerData ) {
		if (layerData.type && layerData.type == "tile") {
			var layer = new Layer( layerData, this.tileSets );
			this.layers[ layerData.name ] = layer;
			this.addLayer( layer );
		}
	}, this );
}

TiledMap.prototype = Object.create( PIXI.Container.prototype );

TiledMap.prototype.addLayer = function ( layer ) {
	this.addChild( layer );
};

module.exports = TiledMap;