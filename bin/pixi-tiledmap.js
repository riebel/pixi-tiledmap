"format register";
System.register("src/tiledMapLoader", [], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
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
  global.define = __define;
  return module.exports;
});

System.register("src/TileSet", [], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  var Tileset = function(options) {
    this.baseTexture = PIXI.Texture.fromImage(options.image);
    this.name = options.name;
    this.firstGID = options.firstgid;
    this.imageHeight = options.imageheight;
    this.imageWidth = options.imagewidth;
    this.tileHeight = options.tileheight;
    this.tileWidth = options.tilewidth;
    this.margin = options.margin;
    this.spacing = options.spacing;
    this.textures = [];
    for (var y = this.margin; y < this.imageHeight; y += this.tileHeight + this.spacing) {
      for (var x = this.margin; x < this.imageWidth; x += this.tileWidth + this.spacing) {
        this.textures.push(new PIXI.Texture(this.baseTexture, new PIXI.Rectangle(x, y, this.tileWidth, this.tileHeight)));
      }
    }
  };
  module.exports = PIXI.extras.TileSet = Tileset;
  global.define = __define;
  return module.exports;
});

System.register("src/Tile", [], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  var Tile = function(options) {
    PIXI.Sprite.call(this, options.texture);
    this.gid = options.gid;
    this.width = options.width;
    this.height = options.height;
  };
  Tile.prototype = Object.create(PIXI.Sprite.prototype);
  module.exports = PIXI.extras.Tile = Tile;
  global.define = __define;
  return module.exports;
});

System.register("src/Layer", ["src/Tile"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  var Tile = require("src/Tile");
  function findTexture(gid, tilesets) {
    var tileset,
        i,
        ix;
    for (i = tilesets.length - 1; i >= 0; i--) {
      tileset = tilesets[i];
      if (tileset.firstGID <= gid) {
        break;
      }
    }
    ix = gid - tileset.firstGID;
    return tileset.textures[ix];
  }
  var Layer = function(options, tilesets) {
    PIXI.Container.call(this);
    this.name = options.name;
    this.alpha = options.alpha || 1;
    this.data = options.data;
    this.tilesets = tilesets;
    this.tiles = [];
    this.createTiles(options, tilesets);
  };
  Layer.prototype = Object.create(PIXI.Container.prototype);
  Layer.prototype.createTiles = function(options, tilesets) {
    var x,
        y,
        i,
        gid,
        tile;
    for (y = 0; y < options.height; y++) {
      for (x = 0; x < options.width; x++) {
        i = x + (y * options.width);
        gid = options.data[i];
        var texture = findTexture(gid, tilesets);
        if (gid !== 0 && texture) {
          tile = new Tile({
            gid: gid,
            texture: texture,
            width: texture.width,
            height: texture.height
          });
          tile.x = x * texture.width;
          tile.y = y * texture.height;
          this.tiles.push(tile);
          this.addTile(tile);
        }
      }
    }
  };
  Layer.prototype.addTile = function(tile) {
    this.addChild(tile);
  };
  Layer.prototype.getTilesByGid = function(gids) {
    if (!Array.isArray(gids)) {
      gids = [gids];
    }
    return this.children.filter(function(tile) {
      return gids.indexOf(tile.gid) > -1;
    });
  };
  module.exports = PIXI.extras.TileLayer = Layer;
  global.define = __define;
  return module.exports;
});

System.register("src/TiledMap", ["src/TileSet", "src/Layer"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  var TileSet = require("src/TileSet");
  var Layer = require("src/Layer");
  var TiledMap = function(resourceName) {
    PIXI.Container.call(this);
    this.layers = [];
    this.tilesets = [];
    var data = PIXI.loader.resources[resourceName].data;
    data.tilesets.forEach(function(tilesetData) {
      this.tilesets.push(new TileSet(tilesetData));
    }, this);
    data.layers.forEach(function(layerData) {
      var layer = new Layer(layerData, this.tilesets);
      this.layers[layerData.name] = layer;
      this.addLayer(layer);
    }, this);
  };
  TiledMap.prototype = Object.create(PIXI.Container.prototype);
  TiledMap.prototype.addLayer = function(layer) {
    this.addChild(layer);
  };
  TiledMap.prototype.getLayerByName = function(name) {
    return this.layers[name];
  };
  TiledMap.prototype.getTilesByGid = function(gids) {
    var tiles = [];
    this.layers.forEach(function(layer) {
      tiles = tiles.concat(layer.getTilesByGid(gids));
    });
    return tiles;
  };
  module.exports = TiledMap;
  global.define = __define;
  return module.exports;
});

System.register("index", ["src/tiledMapLoader", "src/TiledMap"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  var tiledMapLoader = require("src/tiledMapLoader");
  PIXI.loaders.Loader.addPixiMiddleware(tiledMapLoader);
  PIXI.loader.use(tiledMapLoader());
  module.exports = PIXI.extras.TiledMap = require("src/TiledMap");
  global.define = __define;
  return module.exports;
});

//# sourceMappingURL=pixi-tiledmap.js.map