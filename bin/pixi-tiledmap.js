(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var tiledMapLoader = require( "./src/tiledMapLoader" );

PIXI.loaders.Loader.addPixiMiddleware( tiledMapLoader );
PIXI.loader.use( tiledMapLoader() );

module.exports = PIXI.extras.TiledMap = require( "./src/TiledMap" );
},{"./src/TiledMap":5,"./src/tiledMapLoader":6}],2:[function(require,module,exports){
var Tile = require( "./Tile" );

function findTileset ( gid, tilesets ) {
	var tileset;
	for ( var i = tilesets.length - 1; i >= 0; i-- ) {
		tileset = tilesets[ i ];
		if ( tileset.firstGID <= gid ) {
			break;
		}
	}
	return tileset;
}

var Layer = function ( tileWidth, tileHeight, layerData, tilesets ) {
	PIXI.Container.call( this );
	this.name = layerData.name;
	this.visible = layerData.visible;
	this.alpha = layerData.opacity;
	this.data = layerData.data;
	this.tilesets = tilesets;
	this.tiles = [];
	// Bits on the far end of the 32-bit global tile ID are used for tile flags
	var FLIPPED_HORIZONTALLY_FLAG = 0x80000000,
		FLIPPED_VERTICALLY_FLAG = 0x40000000,
		FLIPPED_DIAGONALLY_FLAG = 0x20000000,
		x,
		y,
		i,
		gid,
		tile;

	for ( y = 0; y < layerData.height; y++ ) {
		for ( x = 0; x < layerData.width; x++ ) {
			i = x + (y * layerData.width);

			gid = layerData.data[ i ];

			// Read out the flags
			var flippedHorizontally = Boolean( gid & FLIPPED_HORIZONTALLY_FLAG );
			var flippedVertically = Boolean( gid & FLIPPED_VERTICALLY_FLAG );
			var flippedDiagonally = Boolean( gid & FLIPPED_DIAGONALLY_FLAG );

			// Clear the flags
			gid &= ~(FLIPPED_HORIZONTALLY_FLAG | FLIPPED_VERTICALLY_FLAG | FLIPPED_DIAGONALLY_FLAG);

			var tileset = findTileset( gid, tilesets );
			var texture = tileset.textures[ gid - tileset.firstGID ];

			if ( gid !== 0 && texture ) {
				tile = new Tile( {
					gid: layerData.data[ i ],
					texture: texture,
					width: texture.width,
					height: texture.height,
					flippedHorizontally: flippedHorizontally,
					flippedVertically: flippedVertically,
					flippedDiagonally: flippedDiagonally
				} );

				tile.x = x * tileWidth;
				tile.y = y * tileHeight + ( tileHeight - texture.height );

				if ( tileset.tileOffset ) {
					tile.x += tileset.tileOffset.x;
					tile.y += tileset.tileOffset.y;
				}

				this.tiles.push( tile );
				this.addTile( tile );
			}
		}
	}
};

Layer.prototype = Object.create( PIXI.Container.prototype );

Layer.prototype.addTile = function ( tile ) {
	this.addChild( tile );
};

Layer.prototype.getTilesByGid = function ( gids ) {
	if ( !Array.isArray( gids ) ) {
		gids = [ gids ];
	}
	return this.children.filter( function ( tile ) {
		return gids.indexOf( tile.gid ) > -1;
	} );
};

module.exports = PIXI.extras.TileLayer = Layer;
},{"./Tile":3}],3:[function(require,module,exports){
var Tile = function ( options ) {
	PIXI.Sprite.call( this, options.texture );

	this.gid = options.gid;
	this.width = options.width;
	this.height = options.height;

	this.flippedVertically = options.flippedVertically;
	this.flippedHorizontally = options.flippedHorizontally;
	this.flippedDiagonally = options.flippedDiagonally;

	if ( this.flippedHorizontally || this.flippedDiagonally ) {
		this.scale.x = -1;
		this.anchor.x = 1;
	}

	if ( this.flippedVertically || this.flippedDiagonally ) {
		this.scale.y = -1;
		this.anchor.y = 1;
	}
};

Tile.prototype = Object.create( PIXI.Sprite.prototype );

module.exports = PIXI.extras.Tile = Tile;
},{}],4:[function(require,module,exports){
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
},{}],5:[function(require,module,exports){
var TileSet = require( "./TileSet" ),
	Layer = require( "./Layer" ),
	path = require( "path" );

var TiledMap = function ( resourceUrl ) {
	PIXI.Container.call( this );

	this.layers = [];
	this.tilesets = [];

	var route = path.dirname( resourceUrl );

	var data = PIXI.loader.resources[ resourceUrl ].data;

	data.tilesets.forEach( function ( tilesetData ) {
		this.tilesets.push( new TileSet( route, tilesetData ) );
	}, this );

	data.layers.forEach( function ( layerData ) {
		var layer = new Layer( data.tilewidth, data.tileheight, layerData, this.tilesets );
		this.layers[ layerData.name ] = layer;
		this.addLayer( layer );
	}, this );
};

TiledMap.prototype = Object.create( PIXI.Container.prototype );

TiledMap.prototype.addLayer = function ( layer ) {
	this.addChild( layer );
};

TiledMap.prototype.getTilesByGid = function ( gids ) {
	var tiles = [];

	this.layers.forEach( function ( layer ) {
		tiles = tiles.concat( layer.getTilesByGid( gids ) );
	} );

	return tiles;
};

module.exports = TiledMap;
},{"./Layer":2,"./TileSet":4,"path":7}],6:[function(require,module,exports){
var Resource = PIXI.loaders.Resource,
	path = require( "path" );

module.exports = function () {
	return function ( resource, next ) {
		if ( !resource.data || !resource.isJson || !resource.data.layers || !resource.data.tilesets ) {
			return next();
		}

		var loadOptions = {
			crossOrigin: resource.crossOrigin,
			loadType: Resource.LOAD_TYPE.IMAGE
		};

		var tileSets = resource.data.tilesets;

		for ( var i = 0; i < tileSets.length; i++ ) {
			var route = path.dirname( resource.url.replace( this.baseUrl, '' ) );
			this.add( tileSets[ i ].name, route + '/' + tileSets[ i ].image, loadOptions );
		}

		next();
	};
};
},{"path":7}],7:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
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

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
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

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
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
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
};


exports.basename = function(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPath(path)[3];
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require('_process'))
},{"_process":8}],8:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            currentQueue[queueIndex].run();
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}]},{},[1]);
