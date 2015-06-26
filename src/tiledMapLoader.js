var Resource = PIXI.loaders.Resource,
	path = require( "path" );

module.exports = function () {
	return function ( resource, next ) {
		if ( !resource.data || !resource.isJson || !resource.data.layers || !resource.data.tilesets ) {
			return next();
		}

		var loadOptions = {
			crossOrigin: resource.crossOrigin,
			loadType: Resource.LOAD_TYPE.IMAGE
		};

		var tileSets = resource.data.tilesets;

		for ( var i = 0; i < tileSets.length; i++ ) {
			var route = path.dirname( resource.url.replace( this.baseUrl, '' ) );
			this.add( tileSets[ i ].name, route + '/' + tileSets[ i ].image, loadOptions );
		}

		next();
	};
};