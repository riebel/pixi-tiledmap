function Tile(tile, tileSet, horizontalFlip, verticalFlip, diagonalFlip) {
    var textures = [];

    if (tile.animations.length) {
        tile.animations.forEach(function(frame) {
            textures.push(tileSet.textures[frame.tileId]);
        }, this);
    }
    else {
        textures.push(tileSet.textures[tile.gid - tileSet.firstGid]);
    }

    PIXI.extras.AnimatedSprite.call(this, textures);

    for (var property in tile) {
        if (tile.hasOwnProperty(property)) {
            this[property] = tile[property];
        }
    }

    if (horizontalFlip) {
        this.anchor.x = 1;
        this.scale.x = -1;
    }

    if (verticalFlip) {
        this.anchor.y = 1;
        this.scale.y = -1;
    }

    if (diagonalFlip) {
        if (horizontalFlip) {
            this.anchor.x = 0;
            this.scale.x = 1;
            this.anchor.y = 1;
            this.scale.y = 1;

            this.rotation = PIXI.DEG_TO_RAD * 90;
        }
        if (verticalFlip) {
            this.anchor.x = 1;
            this.scale.x = 1;
            this.anchor.y = 0;
            this.scale.y = 1;

            this.rotation = PIXI.DEG_TO_RAD * -90;
        }
    }

    this.textures = textures;
    this.tileSet = tileSet;
}

Tile.prototype = Object.create(PIXI.extras.AnimatedSprite.prototype);

module.exports = Tile;
