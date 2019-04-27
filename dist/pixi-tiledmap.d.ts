/// <reference types="pixi.js" />
declare module "TileSet" {
    export default class TileSet {
        firstGid: number;
        baseTexture: PIXI.Texture;
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
        constructor(route: string, tileSet: TileSet);
    }
}
declare module "Tile" {
    import TileSet from "TileSet";
    export default class Tile extends PIXI.extras.AnimatedSprite {
        animations: Tile[];
        duration: number;
        tileId: number;
        gid: number;
        _x: number;
        _y: number;
        tile: Tile;
        tileSet: TileSet;
        horizontalFlip: boolean;
        verticalFlip: boolean;
        diagonalFlip: boolean;
        constructor(tile: Tile, tileSet: TileSet, horizontalFlip: boolean, verticalFlip: boolean, diagonalFlip: boolean);
        private flip;
    }
}
declare module "TileLayer" {
    import Tile from "Tile";
    import { TiledMap } from "TiledMap";
    import TileSet from "TileSet";
    export default class TileLayer extends PIXI.Container {
        private static findTileSet;
        name: string;
        layer: TileLayer;
        tileSets: TileSet[];
        tiles: Tile[];
        diagonalFlips: boolean[];
        horizontalFlips: boolean[];
        image: {
            source: string;
            height: number;
            width: number;
        };
        opacity: string;
        type: string;
        verticalFlips: boolean[];
        map: TiledMap;
        constructor(layer: TileLayer, tileSets: TileSet[]);
        create(): void;
    }
}
declare module "TiledMap" {
    import TileLayer from "TileLayer";
    import TileSet from "TileSet";
    export class TiledMap extends PIXI.Container {
        resourceUrl: string;
        tileSets: TileSet[];
        layers: {
            [index: string]: TileLayer;
        };
        background: PIXI.Graphics;
        _width?: number;
        tileWidth: number;
        _height?: number;
        tileHeight: number;
        constructor(resourceUrl: string);
        create(): void;
    }
}
declare module "ImageLayer" {
    import Tile from "Tile";
    import { TiledMap } from "TiledMap";
    import TileLayer from "TileLayer";
    export default class ImageLayer extends PIXI.Container {
        name: string;
        diagonalFlips: boolean[];
        horizontalFlips: boolean[];
        image: {
            source: string;
            height: number;
            width: number;
        };
        map: TiledMap;
        opacity: string;
        tiles: Tile[];
        type: string;
        verticalFlips: boolean[];
        constructor(layer: TileLayer, route: string);
    }
}
declare module "tiledMapLoader" {
    function tileMapLoader(this: PIXI.loaders.Loader): (resource: PIXI.loaders.Resource, next: () => void) => void;
    export default tileMapLoader;
}
declare module "index" {
    import { TiledMap } from "TiledMap";
    export default TiledMap;
}
