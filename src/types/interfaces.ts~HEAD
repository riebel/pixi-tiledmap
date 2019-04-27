interface ITMXData {
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

interface ILayerData {
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

interface ITileSetData {
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

interface ITileData {
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

interface IAnimation {
  tileId: number;
  duration: number;
}
