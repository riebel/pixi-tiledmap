import Tile from './Tile';

export default class TileLayer extends PIXI.Container {
    constructor(layer, tileSets) {
        super();

        this.layer = layer;
        this.tileSets = tileSets;

        this.alpha = parseFloat(layer.opacity);
        this.tiles = [];

        Object.assign(this, layer);

        this.create();
    }

    create() {
        for (let y = 0; y < this.layer.map.height; y++) {
            for (let x = 0; x < this.layer.map.width; x++) {
                let i = x + (y * this.layer.map.width);

                if (this.layer.tiles[i]) {

                    if (this.layer.tiles[i].gid && this.layer.tiles[i].gid !== 0) {

                        let tileset = TileLayer.findTileset(this.layer.tiles[i].gid, this.tileSets);
                        let tile = new Tile(this.layer.tiles[i], tileset, this.layer.horizontalFlips[i], this.layer.verticalFlips[i], this.layer.diagonalFlips[i]);

                        tile.x = x * this.layer.map.tileWidth;
                        tile.y = y * this.layer.map.tileHeight + (this.layer.map.tileHeight - tile.textures[0].height);

                        tile._x = x;
                        tile._y = y;

                        if (tileset.tileOffset) {
                            tile.x += tileset.tileOffset.x;
                            tile.y += tileset.tileOffset.y;
                        }

                        if (tile.textures.length > 1) {
                            tile.animationSpeed = 1000 / 60 / tile.animations[0].duration;
                            tile.gotoAndPlay(0);
                        }

                        this.tiles.push(tile);

                        this.addChild(tile);
                    }
                }
            }
        }
    }

    static findTileset(gid, tileSets) {
        let tileset;
        for (let i = tileSets.length - 1; i >= 0; i--) {
            tileset = tileSets[i];
            if (tileset.firstGid <= gid) {
                break;
            }
        }
        return tileset;
    }
}