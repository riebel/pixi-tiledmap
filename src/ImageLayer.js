export default class ImageLayer extends PIXI.Container {
    constructor(layer, route) {
        super();

        Object.assign(this, layer);

        this.alpha = parseFloat(layer.opacity);

        if (layer.image && layer.image.source) {
            this.addChild(new PIXI.Sprite.fromImage(route + '/' + layer.image.source));
        }
    }
}