import Tile from './Tile';
import { TiledMap } from './TiledMap';
import TileLayer from './TileLayer';

export default class ImageLayer extends PIXI.Container {
  public name: string = '';
  public diagonalFlips: boolean[] = [];
  public horizontalFlips: boolean[] = [];
  public image: { source: string; height: number; width: number } = { source: '', height: 0, width: 0 };
  // @ts-ignore
  public map: TiledMap = {
    _height: 0,
    _width: 0,
    background: new PIXI.Graphics(),
    height: 0,
    layers: {},
    resourceUrl: '',
    tileHeight: 0,
    tileSets: [],
    tileWidth: 0,
    width: 0,
  };
  public opacity: string = '';
  public tiles: Tile[] = [];
  public type: string = '';
  public verticalFlips: boolean[] = [];

  constructor(layer: TileLayer, route: string) {
    super();

    Object.assign(this, layer);

    this.alpha = parseFloat(layer.opacity);

    if (layer.image && layer.image.source) {
      this.addChild(PIXI.Sprite.fromImage(`${route}/${layer.image.source}`));
    }
  }
}
