import { TiledMap } from './TiledMap';
import tiledMapLoader from './tiledMapLoader';

PIXI.loaders.Loader.addPixiMiddleware(tiledMapLoader);
PIXI.loader.use(tiledMapLoader);

Object.assign(PIXI.extras, { TiledMap });

export default TiledMap;
