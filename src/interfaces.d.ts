/// <reference types="pixi.js" />

declare interface ITileMap {
  resourceUrl: string;
  tileSets: ITileSetData[];
  layers: {[index: string]: ILayerData};
  background: PIXI.Graphics;
  // tslint:disable-next-line:variable-name
  _width?: number;
  tileWidth: number;
  // tslint:disable-next-line:variable-name
  _height?: number;
  tileHeight: number;
  height: number;
  width: number;
}

declare interface ITileSetData {
  firstGid: number;
  textures: PIXI.Texture[];
  margin: number;
  spacing: number;
  tileHeight: number;
  tileWidth: number;
  image: {
    source: string;
    height: number;
    width: number;
  };
  tileOffset?: {
    x: number;
    y: number;
  };
}

declare interface ILayerData {
  map: ITileMap;
  type: string;
  name: string;
  image: {
    source: string;
    height: number;
    width: number;
  };
  opacity: string;
  tiles: ITileData[];
  horizontalFlips: boolean[];
  verticalFlips: boolean[];
  diagonalFlips: boolean[];
}

declare interface ITileData {
  duration: number;
  animations: ITileData[];
  tileId: number;
  gid: number;
  _x: number;
  _y: number;
}
