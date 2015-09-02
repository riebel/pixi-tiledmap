var Resource = PIXI.loaders.Resource,
	path = require( "path" ),
	xml2js  = require("xml2js" );

module.exports = function () {
	return function ( resource, next ) {

		if ( !resource.data || !resource.isXml || !resource.data.children[ 0 ].getElementsByTagName("tileset") ) {
			return next();
		}

		var route = path.dirname( resource.url.replace( this.baseUrl, '' ) );

		var loadOptions = {
			crossOrigin: resource.crossOrigin,
			loadType: Resource.LOAD_TYPE.IMAGE
		};
		var that = this;

		var parser = new xml2js.Parser();

		parser.parseString(resource.xhr.responseText, function (err, result) {

			for ( var i = 0; i < result.map.tileset.length; i++ ) {
				that.add( result.map.tileset[ i ].image[0].$.source , route + '/' + result.map.tileset[ i ].image[0].$.source, loadOptions );
			}

			resource.data = result;
			next();
		});
	};
};