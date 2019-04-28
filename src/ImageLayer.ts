export default class ImageLayer extends PIXI.Container {

  constructor(layer: ILayerData, route: string) {
    super();

    Object.assign(this, layer);

    this.alpha = layer.opacity;

    if (layer.image && layer.image.source) {
      this.addChild(PIXI.Sprite.fromImage(`${route}/${layer.image.source}`));
    }
  }
}
