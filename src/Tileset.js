var Tileset = function ( route, tilesetData ) {
	this.baseTexture = PIXI.Texture.fromImage( route + "/" + tilesetData.image[ 0 ].$.source, false, PIXI.SCALE_MODES.NEAREST );
	this.name = tilesetData.$.name;
	this.firstGID = parseInt(tilesetData.$.firstgid);
	this.imageHeight = parseInt(tilesetData.image[ 0 ].$.height);
	this.imageWidth = parseInt(tilesetData.image[ 0 ].$.width);
	this.tileHeight = parseInt(tilesetData.$.tileheight);
	this.tileWidth = parseInt(tilesetData.$.tilewidth);
	this.tileOffset = parseInt(tilesetData.$.tileoffset) || 0;
	this.margin = parseInt(tilesetData.$.margin) || 0;
	this.spacing = parseInt(tilesetData.$.spacing) || 0;
	this.textures = [];

	for ( var y = this.margin; y < this.imageHeight; y += this.tileHeight + this.spacing ) {
		for ( var x = this.margin; x < this.imageWidth; x += this.tileWidth + this.spacing ) {
			this.textures.push( new PIXI.Texture( this.baseTexture, new PIXI.Rectangle( x, y, this.tileWidth, this.tileHeight ) ) );
		}
	}
};

module.exports = PIXI.extras.TileSet = Tileset;