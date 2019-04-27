import { TiledMap } from './TiledMap';
import tiledMapLoader from './tiledMapLoader';

declare global {
  namespace PIXI.extras {
    interface ITiledMap {
      TiledMap: TiledMap;
    }
  }
}

PIXI.loaders.Loader.addPixiMiddleware(tiledMapLoader);
PIXI.loader.use(tiledMapLoader.call(PIXI.loader));

Object.assign(PIXI.extras, { TiledMap });

export default TiledMap;
