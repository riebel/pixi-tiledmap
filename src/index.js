import tiledMapLoader from './tiledMapLoader';
import TiledMap from './TiledMap';

PIXI.loaders.Loader.addPixiMiddleware(tiledMapLoader);
PIXI.loader.use(tiledMapLoader());

export default PIXI.extras.TiledMap = TiledMap;