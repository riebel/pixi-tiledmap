"format register";
System.register("npm:process@0.10.1/browser", [], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  var process = module.exports = {};
  var queue = [];
  var draining = false;
  function drainQueue() {
    if (draining) {
      return ;
    }
    draining = true;
    var currentQueue;
    var len = queue.length;
    while (len) {
      currentQueue = queue;
      queue = [];
      var i = -1;
      while (++i < len) {
        currentQueue[i]();
      }
      len = queue.length;
    }
    draining = false;
  }
  process.nextTick = function(fun) {
    queue.push(fun);
    if (!draining) {
      setTimeout(drainQueue, 0);
    }
  };
  process.title = 'browser';
  process.browser = true;
  process.env = {};
  process.argv = [];
  process.version = '';
  process.versions = {};
  function noop() {}
  process.on = noop;
  process.addListener = noop;
  process.once = noop;
  process.off = noop;
  process.removeListener = noop;
  process.removeAllListeners = noop;
  process.emit = noop;
  process.binding = function(name) {
    throw new Error('process.binding is not supported');
  };
  process.cwd = function() {
    return '/';
  };
  process.chdir = function(dir) {
    throw new Error('process.chdir is not supported');
  };
  process.umask = function() {
    return 0;
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
    this.flippedVertically = options.flippedVertically;
    this.flippedHorizontally = options.flippedHorizontally;
    this.flippedDiagonally = options.flippedDiagonally;
    if (this.flippedHorizontally) {
      this.scale.x = -1;
      this.anchor.x = 1;
    }
    if (this.flippedVertically) {
      this.scale.y = -1;
      this.anchor.y = 1;
    }
    if (this.flippedDiagonally) {
      this.scale.x = -1;
      this.anchor.x = 1;
      this.scale.y = -1;
      this.anchor.y = 1;
    }
  };
  Tile.prototype = Object.create(PIXI.Sprite.prototype);
  module.exports = PIXI.extras.Tile = Tile;
  global.define = __define;
  return module.exports;
});

System.register("npm:process@0.10.1", ["npm:process@0.10.1/browser"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  module.exports = require("npm:process@0.10.1/browser");
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
    var FLIPPED_HORIZONTALLY_FLAG = 0x80000000,
        FLIPPED_VERTICALLY_FLAG = 0x40000000,
        FLIPPED_DIAGONALLY_FLAG = 0x20000000,
        x,
        y,
        i,
        gid,
        tile;
    for (y = 0; y < options.height; y++) {
      for (x = 0; x < options.width; x++) {
        i = x + (y * options.width);
        gid = options.data[i];
        var flippedHorizontally = Boolean(gid & FLIPPED_HORIZONTALLY_FLAG);
        var flippedVertically = Boolean(gid & FLIPPED_VERTICALLY_FLAG);
        var flippedDiagonally = Boolean(gid & FLIPPED_DIAGONALLY_FLAG);
        gid &= ~(FLIPPED_HORIZONTALLY_FLAG | FLIPPED_VERTICALLY_FLAG | FLIPPED_DIAGONALLY_FLAG);
        var texture = findTexture(gid, tilesets);
        if (gid !== 0 && texture) {
          tile = new Tile({
            gid: gid,
            texture: texture,
            width: texture.width,
            height: texture.height,
            flippedHorizontally: flippedHorizontally,
            flippedVertically: flippedVertically,
            flippedDiagonally: flippedDiagonally
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

System.register("github:jspm/nodelibs-process@0.1.1/index", ["npm:process@0.10.1"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  module.exports = System._nodeRequire ? process : require("npm:process@0.10.1");
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

System.register("github:jspm/nodelibs-process@0.1.1", ["github:jspm/nodelibs-process@0.1.1/index"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  module.exports = require("github:jspm/nodelibs-process@0.1.1/index");
  global.define = __define;
  return module.exports;
});

System.register("npm:path-browserify@0.0.0/index", ["github:jspm/nodelibs-process@0.1.1"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  (function(process) {
    function normalizeArray(parts, allowAboveRoot) {
      var up = 0;
      for (var i = parts.length - 1; i >= 0; i--) {
        var last = parts[i];
        if (last === '.') {
          parts.splice(i, 1);
        } else if (last === '..') {
          parts.splice(i, 1);
          up++;
        } else if (up) {
          parts.splice(i, 1);
          up--;
        }
      }
      if (allowAboveRoot) {
        for (; up--; up) {
          parts.unshift('..');
        }
      }
      return parts;
    }
    var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
    var splitPath = function(filename) {
      return splitPathRe.exec(filename).slice(1);
    };
    exports.resolve = function() {
      var resolvedPath = '',
          resolvedAbsolute = false;
      for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
        var path = (i >= 0) ? arguments[i] : process.cwd();
        if (typeof path !== 'string') {
          throw new TypeError('Arguments to path.resolve must be strings');
        } else if (!path) {
          continue;
        }
        resolvedPath = path + '/' + resolvedPath;
        resolvedAbsolute = path.charAt(0) === '/';
      }
      resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
        return !!p;
      }), !resolvedAbsolute).join('/');
      return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
    };
    exports.normalize = function(path) {
      var isAbsolute = exports.isAbsolute(path),
          trailingSlash = substr(path, -1) === '/';
      path = normalizeArray(filter(path.split('/'), function(p) {
        return !!p;
      }), !isAbsolute).join('/');
      if (!path && !isAbsolute) {
        path = '.';
      }
      if (path && trailingSlash) {
        path += '/';
      }
      return (isAbsolute ? '/' : '') + path;
    };
    exports.isAbsolute = function(path) {
      return path.charAt(0) === '/';
    };
    exports.join = function() {
      var paths = Array.prototype.slice.call(arguments, 0);
      return exports.normalize(filter(paths, function(p, index) {
        if (typeof p !== 'string') {
          throw new TypeError('Arguments to path.join must be strings');
        }
        return p;
      }).join('/'));
    };
    exports.relative = function(from, to) {
      from = exports.resolve(from).substr(1);
      to = exports.resolve(to).substr(1);
      function trim(arr) {
        var start = 0;
        for (; start < arr.length; start++) {
          if (arr[start] !== '')
            break;
        }
        var end = arr.length - 1;
        for (; end >= 0; end--) {
          if (arr[end] !== '')
            break;
        }
        if (start > end)
          return [];
        return arr.slice(start, end - start + 1);
      }
      var fromParts = trim(from.split('/'));
      var toParts = trim(to.split('/'));
      var length = Math.min(fromParts.length, toParts.length);
      var samePartsLength = length;
      for (var i = 0; i < length; i++) {
        if (fromParts[i] !== toParts[i]) {
          samePartsLength = i;
          break;
        }
      }
      var outputParts = [];
      for (var i = samePartsLength; i < fromParts.length; i++) {
        outputParts.push('..');
      }
      outputParts = outputParts.concat(toParts.slice(samePartsLength));
      return outputParts.join('/');
    };
    exports.sep = '/';
    exports.delimiter = ':';
    exports.dirname = function(path) {
      var result = splitPath(path),
          root = result[0],
          dir = result[1];
      if (!root && !dir) {
        return '.';
      }
      if (dir) {
        dir = dir.substr(0, dir.length - 1);
      }
      return root + dir;
    };
    exports.basename = function(path, ext) {
      var f = splitPath(path)[2];
      if (ext && f.substr(-1 * ext.length) === ext) {
        f = f.substr(0, f.length - ext.length);
      }
      return f;
    };
    exports.extname = function(path) {
      return splitPath(path)[3];
    };
    function filter(xs, f) {
      if (xs.filter)
        return xs.filter(f);
      var res = [];
      for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs))
          res.push(xs[i]);
      }
      return res;
    }
    var substr = 'ab'.substr(-1) === 'b' ? function(str, start, len) {
      return str.substr(start, len);
    } : function(str, start, len) {
      if (start < 0)
        start = str.length + start;
      return str.substr(start, len);
    };
    ;
  })(require("github:jspm/nodelibs-process@0.1.1"));
  global.define = __define;
  return module.exports;
});

System.register("npm:path-browserify@0.0.0", ["npm:path-browserify@0.0.0/index"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  module.exports = require("npm:path-browserify@0.0.0/index");
  global.define = __define;
  return module.exports;
});

System.register("github:jspm/nodelibs-path@0.1.0/index", ["npm:path-browserify@0.0.0"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  module.exports = System._nodeRequire ? System._nodeRequire('path') : require("npm:path-browserify@0.0.0");
  global.define = __define;
  return module.exports;
});

System.register("github:jspm/nodelibs-path@0.1.0", ["github:jspm/nodelibs-path@0.1.0/index"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  module.exports = require("github:jspm/nodelibs-path@0.1.0/index");
  global.define = __define;
  return module.exports;
});

System.register("src/tiledMapLoader", ["github:jspm/nodelibs-path@0.1.0"], true, function(require, exports, module) {
  var global = System.global,
      __define = global.define;
  global.define = undefined;
  var path = require("github:jspm/nodelibs-path@0.1.0");
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