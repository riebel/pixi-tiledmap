var PIXI = require("pixi.js");

var TileSet = function ( route, tileSet ) {
	this.baseTexture = PIXI.Texture.fromImage( route + "/" + tileSet.image.source, false, PIXI.SCALE_MODES.NEAREST );
	this.name = tileSet.name;
	this.firstGID = parseInt(tileSet.firstGid) || 0;
	this.imageHeight = parseInt(tileSet.image.height) || 0;
	this.imageWidth = parseInt(tileSet.image.width) || 0;
	this.tileHeight = parseInt(tileSet.tileHeight) || 0;
	this.tileWidth = parseInt(tileSet.tileWidth) || 0;
	this.tileOffset = tileSet.tileOffset;
	this.margin = tileSet.margin;
	this.spacing = tileSet.spacing;
	this.textures = [];

	for ( var y = this.margin; y < this.imageHeight; y += this.tileHeight + this.spacing ) {
		for ( var x = this.margin; x < this.imageWidth; x += this.tileWidth + this.spacing ) {
			this.textures.push( new PIXI.Texture( this.baseTexture, new PIXI.Rectangle( x, y, this.tileWidth, this.tileHeight ) ) );
		}
	}
};

module.exports = PIXI.extras.TileSet = TileSet;