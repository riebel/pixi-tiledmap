var TileSet = require( "./TileSet" ),
	TileLayer = require( "./TileLayer" ),
	ImageLayer = require( "./ImageLayer" ),
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
		switch (layerData.type) {
			case "tile":
				var tileLayer = new TileLayer( layerData, this.tileSets );
				this.layers[ layerData.name ] = tileLayer;
				this.addLayer( tileLayer );
				break;
			case "image":
				var imageLayer = new ImageLayer( layerData, route );
				this.layers[ layerData.name ] = imageLayer;
				this.addLayer( imageLayer );
				break;
			default:
				this.layers[ layerData.name ] = layerData;
		}
	}, this );
}

TiledMap.prototype = Object.create( PIXI.Container.prototype );

TiledMap.prototype.addLayer = function ( layer ) {
	this.addChild( layer );
};

module.exports = TiledMap;