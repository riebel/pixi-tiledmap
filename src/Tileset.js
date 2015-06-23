/**
 * Tileset
 * @constructor
 */
var Tileset = function ( options ) {

	this.baseTexture = PIXI.Texture.fromImage( options.image );
	this.name = options.name;
	this.firstGID = options.firstgid;
	this.imageHeight = options.imageheight;
	this.imageWidth = options.imagewidth;
	this.tileHeight = options.tileheight;
	this.tileWidth = options.tilewidth;
	this.margin = options.margin;
	this.spacing = options.spacing;
	this.textures = [];

	for ( var y = this.margin; y < this.imageHeight; y += this.tileHeight + this.spacing ) {
		for ( var x = this.margin; x < this.imageWidth; x += this.tileWidth + this.spacing ) {
			this.textures.push( new PIXI.Texture( this.baseTexture, new PIXI.Rectangle( x, y, this.tileWidth, this.tileHeight ) ) );
		}
	}
};

module.exports = PIXI.extras.TileSet = Tileset;
