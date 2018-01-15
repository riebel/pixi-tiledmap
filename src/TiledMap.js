import TileSet from './TileSet';
import TileLayer from './TileLayer';
import ImageLayer from './ImageLayer';
import path from 'path';

export default class TiledMap extends PIXI.Container {

    constructor(resourceUrl) {
        super();

        this.resourceUrl = resourceUrl;
        this.tileSets = [];
        this.layers = [];
        this.background = new PIXI.Graphics();

        this.create();
    }

    create() {
        const route = path.dirname(PIXI.loader.resources[this.resourceUrl].url);
        const data = PIXI.loader.resources[this.resourceUrl].data;

        Object.assign(this, data);

        this.background.beginFill(0x000000, 0);
        this.background.drawRect(0, 0, this._width * this.tileWidth, this._height * this.tileHeight);
        this.background.endFill();
        this.addChild(this.background);

        data.tileSets.forEach(tilesetData => {
            this.tileSets.push(new TileSet(route, tilesetData));
        }, this);

        data.layers.forEach(layerData => {
            switch (layerData.type) {
                case 'tile': {
                    let tileLayer = new TileLayer(layerData, this.tileSets);
                    this.layers[layerData.name] = tileLayer;
                    this.addChild(tileLayer);
                    break;
                }
                case 'image': {
                    let imageLayer = new ImageLayer(layerData, route);
                    this.layers[layerData.name] = imageLayer;
                    this.addChild(imageLayer);
                    break;
                }
                default: {
                    this.layers[layerData.name] = layerData;
                }
            }
        });
    }
}