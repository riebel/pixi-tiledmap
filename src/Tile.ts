export default class Tile extends PIXI.extras.AnimatedSprite implements ITileData {
  public animations: ITileData[] = [];
  public duration: number = 0;
  public tileId: number = 0;
  public gid: number = 0;
  // tslint:disable-next-line:variable-name
  public _x: number = 0;
  // tslint:disable-next-line:variable-name
  public _y: number = 0;
  public tile: ITileData;
  public tileSet: ITileSetData;
  public horizontalFlip: boolean;
  public verticalFlip: boolean;
  public diagonalFlip: boolean;

  // @ts-ignore
  constructor(
    tile: ITileData,
    tileSet: ITileSetData,
    horizontalFlip: boolean,
    verticalFlip: boolean,
    diagonalFlip: boolean,
  ) {
    const textures = [];

    if (tile.animations.length) {
      // tslint:disable-next-line:ter-arrow-parens
      tile.animations.forEach(frame => {
        textures.push(tileSet.textures[frame.tileId]);
      });
    } else {
      textures.push(tileSet.textures[tile.gid - tileSet.firstGid]);
    }

    super(textures);

    this.textures = textures;
    this.tile = tile;
    this.tileSet = tileSet;
    this.horizontalFlip = horizontalFlip;
    this.verticalFlip = verticalFlip;
    this.diagonalFlip = diagonalFlip;

    Object.assign(this, tile);

    this.flip();
  }

  private flip() {
    if (this.horizontalFlip) {
      this.anchor.x = 1;
      this.scale.x = -1;
    }

    if (this.verticalFlip) {
      this.anchor.y = 1;
      this.scale.y = -1;
    }

    if (this.diagonalFlip) {
      if (this.horizontalFlip) {
        this.anchor.x = 0;
        this.scale.x = 1;
        this.anchor.y = 1;
        this.scale.y = 1;

        this.rotation = PIXI.DEG_TO_RAD * 90;
      }
      if (this.verticalFlip) {
        this.anchor.x = 1;
        this.scale.x = 1;
        this.anchor.y = 0;
        this.scale.y = 1;

        this.rotation = PIXI.DEG_TO_RAD * -90;
      }
    }
  }
}
