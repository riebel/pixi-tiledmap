export default class TileSet {

  public firstGid: number = 0;
  public baseTexture: PIXI.Texture;
  public textures: PIXI.Texture[];
  public margin: number = 0;
  public spacing: number = 0;
  public tileHeight: number = 0;
  public tileWidth: number = 0;
  public image: {
    source: string;
    height: number;
    width: number;
  } = {
    height: 0,
    source: '',
    width: 0,
  };
  public tileOffset?: {
    x: number;
    y: number;
  };

  constructor(route: string, tileSet: TileSet) {
    Object.assign(this, tileSet);

    this.baseTexture = PIXI.Texture.fromImage(`${route}/${this.image.source}`, false, PIXI.SCALE_MODES.NEAREST);
    this.textures = [];

    for (let y = this.margin; y < this.image.height; y += this.tileHeight + this.spacing) {
      for (let x = this.margin; x < this.image.width; x += this.tileWidth + this.spacing) {
        this.textures.push(
          new PIXI.Texture(
            this.baseTexture as unknown as PIXI.BaseTexture,
            new PIXI.Rectangle(x, y, this.tileWidth, this.tileHeight),
          ),
        );
      }
    }
  }
}
