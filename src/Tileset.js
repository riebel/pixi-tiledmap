var Tileset = function ( route, tilesetData ) {
	this.baseTexture = PIXI.Texture.fromImage( route + "/" + tilesetData.image );
	this.name = tilesetData.name;
	this.firstGID = tilesetData.firstgid;
	this.imageHeight = tilesetData.imageheight;
	this.imageWidth = tilesetData.imagewidth;
	this.tileHeight = tilesetData.tileheight;
	this.tileWidth = tilesetData.tilewidth;
	this.tileOffset = tilesetData.tileoffset;
	this.margin = tilesetData.margin;
	this.spacing = tilesetData.spacing;
	this.textures = [];

	for ( var y = this.margin; y < this.imageHeight; y += this.tileHeight + this.spacing ) {
		for ( var x = this.margin; x < this.imageWidth; x += this.tileWidth + this.spacing ) {
			this.textures.push( new PIXI.Texture( this.baseTexture, new PIXI.Rectangle( x, y, this.tileWidth, this.tileHeight ) ) );
		}
	}
};

module.exports = PIXI.extras.TileSet = Tileset;