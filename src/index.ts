import { TiledMap } from './TiledMap';
import tiledMapLoader from './tiledMapLoader';

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

PIXI.loaders.Loader.addPixiMiddleware(tiledMapLoader);
PIXI.loader.use(tiledMapLoader.call(PIXI.loader));

Object.assign(PIXI.extras, { TiledMap });

export default TiledMap;
