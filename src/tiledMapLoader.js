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
