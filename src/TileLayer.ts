import Tile from './Tile';
import { TiledMap } from './TiledMap';
import TileSet from './TileSet';

export default class TileLayer extends PIXI.Container {

  private static findTileSet(gid: number, tileSets: TileSet[]) {
    let tileset;
    for (let i = tileSets.length - 1; i >= 0; i--) {
      tileset = tileSets[i];
      if (tileset.firstGid && tileset.firstGid <= gid) {
        break;
      }
    }
    return tileset;
  }

  public name: string = '';
  public layer: TileLayer;
  public tileSets: TileSet[];
  public tiles: Tile[];
  public diagonalFlips: boolean[] = [];
  public horizontalFlips: boolean[] = [];
  public image: { source: string; height: number; width: number } = { source: '', height: 0, width: 0 };
  public opacity: string = '';
  public type: string = '';
  public verticalFlips: boolean[] = [];
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

  constructor(layer: TileLayer, tileSets: TileSet[]) {
    super();

    this.layer = layer;
    this.tileSets = tileSets;

    this.alpha = parseFloat(layer.opacity);
    this.tiles = [];

    Object.assign(this, layer);

    this.create();
  }

  public create() {
    for (let y = 0; y < this.layer.map.height; y++) {
      for (let x = 0; x < this.layer.map.width; x++) {
        const i = x + (y * this.layer.map.width);

        if (this.layer.tiles[i] && this.layer.tiles[i].gid && this.layer.tiles[i].gid !== 0) {

          const tileset = TileLayer.findTileSet(this.layer.tiles[i].gid, this.tileSets);

          if (tileset) {
            const tile = new Tile(
              this.layer.tiles[i],
              tileset,
              this.layer.horizontalFlips[i],
              this.layer.verticalFlips[i],
              this.layer.diagonalFlips[i],
            );

            tile.x = x * this.layer.map.tileWidth;
            // @ts-ignore
            tile.y = y * this.layer.map.tileHeight + (this.layer.map.tileHeight - tile.textures[0].height);

            tile._x = x;
            tile._y = y;

            if (tileset.tileOffset) {
              tile.x += tileset.tileOffset.x;
              tile.y += tileset.tileOffset.y;
            }

            if (tile.textures.length > 1) {
              tile.animationSpeed = 1000 / 60 / tile.animations[0].duration;
              tile.gotoAndPlay(0);
            }

            this.tiles.push(tile);

            this.addChild(tile);
          }
        }
      }
    }
  }
}
