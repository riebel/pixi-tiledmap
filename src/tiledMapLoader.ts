import path from 'path';
import * as tmx from 'tmx-parser';

export interface IAnimation {
  tileId: number;
  duration: number;
}

export interface ITileData {
  animations: IAnimation[];
  gid: number;
  id: number;
  image?: {
    format?: string;
    height: number;
    source: string;
    trans?: boolean;
    width: number;
  };
  objectGroups: [];
  probability?: number;
  properties: {};
  terrain: [];
}

export interface ITileSetData {
  firstGid: number;
  source: string;
  name: string;
  tileWidth: number;
  tileHeight: number;
  spacing?: number;
  margin?: number;
  tileOffset: {
    x: number;
    y: number;
  };
  properties: {};
  image: {
    format?: string;
    height: number;
    source: string;
    trans?: boolean;
    width: number;
  };
  tiles: ITileData[];
  terrainTypes: [];
}

export interface ILayerData {
  map: ITMXData;
  type: string;
  name: string;
  image?: {
    format?: string;
    height: number;
    source: string;
    trans?: boolean;
    width: number;
  };
  opacity: number;
  visible: boolean;
  properties: {};
  tiles: ITileData[];
  horizontalFlips: boolean[];
  verticalFlips: boolean[];
  diagonalFlips: boolean[];
}

export interface ITMXData {
  version: string;
  orientation: string;
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  backgroundColor?: string;
  layers: ILayerData[];
  properties: {};
  tileSets: ITileSetData[];
}

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

    tmx.parse(resource.xhr.responseText, route, (err: Error, map: ITMXData) => {
      if (err) throw err;

      map.tileSets.forEach((tileset: ITileSetData) => {
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
