import path from 'path';
// @ts-ignore
import * as tmx from 'tmx-parser';
import { TiledMap } from './TiledMap';
import TileSet from './TileSet';

function tileMapLoader(this: PIXI.loaders.Loader) {
  return (resource: PIXI.loaders.Resource, next: () => void) => {
    if (
      !resource.data ||
      // @ts-ignore
      resource.type !== PIXI.loaders.Resource.TYPE.XML ||
      !resource.data.children[0].getElementsByTagName('tileset')) {
      return next();
    }

    const route = path.dirname(resource.url.replace(this.baseUrl, ''));

    const loadOptions = {
      crossOrigin: resource.crossOrigin,
      parentResource: resource,
    };

    tmx.parse(resource.xhr.responseText, route, (err: Error, map: TiledMap) => {
      if (err) throw err;

      map.tileSets.forEach((tileset: TileSet) => {
        if (!(tileset.image.source in this.resources)) {
          this.add(tileset.image.source, `${route}/${tileset.image.source}`, loadOptions);
        }
      });

      resource.data = map;
      next();
    });
  };
}

export default tileMapLoader;
