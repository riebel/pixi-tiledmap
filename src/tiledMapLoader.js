var path = require( "path" ),
	tmx = require("tmx-parser");

module.exports = function () {
	return function ( resource, next ) {

		if ( !resource.data || !resource.isXml || !resource.data.children[ 0 ].getElementsByTagName("tileset") ) {
			return next();
		}

		var route = path.dirname( resource.url.replace( this.baseUrl, '' ) );

		var loadOptions = {
			crossOrigin: resource.crossOrigin,
			loadType: PIXI.loaders.Resource.LOAD_TYPE.IMAGE
		};

		var that = this;

		tmx.parse(resource.xhr.responseText, route, function(err, map) {
			if (err) throw err;
			map.tileSets.forEach( function ( tileset ) {
				this.add( tileset.image.source , route + '/' + tileset.image.source, loadOptions );
			}, that);

			resource.data = map;
			next();
		});
	};
};