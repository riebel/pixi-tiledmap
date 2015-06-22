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

	//var id,
	//	i,
	//	p,
	//	tile,
	//	shapeData,
	//	shapes,
	//	shape,
	//	points;
	//for (id in tilesetData.tiles) {
	//	tile = tilesetData.tiles[id];
	//	for (i = 0; i < tile.objectgroup.objects.length; i++) {
	//		shapeData = tile.objectgroup.objects[0];
	//		shapes = [];
	//		if (shapeData.polygon) {
	//			points = [];
	//			for (p = 0; p < shapeData.polygon.length; p++) {
	//				points.push(shapeData.polygon[p].x);
	//				points.push(shapeData.polygon[p].y);
	//			}
	//			shape = new PIXI.Polygon(points);
	//		} else if (shapeData.ellipse) {
	//			shape = new PIXI.Circle(shapeData.x, shapeData.y, shapeData.height / 2);
	//		} else {
	//			shape = new PIXI.Rectangle(shapeData.x, shapeData.y, shapeData.width, shapeData.height);
	//		}
	//		shapes.push(shape);
	//	}
	//	tileset.tiles[+id + 1] = {collision: shapes};
	//}

};

module.exports = PIXI.extras.TileSet = Tileset;
