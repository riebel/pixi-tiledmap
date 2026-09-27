import { Application } from 'pixi.js';
import { exportMap, loadTiledMapAsset } from 'pixi-tiledmap';

const app = new Application();
await app.init({
  width: 864, height: 480,
  background: '#b8e1eb', antialias: true,
});
document.querySelector('#map')!.appendChild(app.canvas);

const { container: map } = await loadTiledMapAsset('./level.tmj');
map.scale.set(0.375);
app.stage.addChild(map);

// Click the gap to build a bridge. The edit updates the map data too.
app.canvas.addEventListener('pointerdown', (event) => {
  const rect = app.canvas.getBoundingClientRect();
  const x = Math.floor((event.clientX - rect.left) * 18 / rect.width);
  if (x < 7 || x > 10) return;
  map.setTile('Bridge', x, 6, { tileset: 'platformer', tileId: 4 });
  document.querySelector('#status')!.textContent = 'Bridge edited in PixiJS';
});

document.querySelector('#export')!.addEventListener('click', () => {
  const json = JSON.stringify(exportMap(map.mapData), null, 2);
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: 'level-edited.tmj' });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  document.querySelector('#status')!.textContent = 'Exported · ready to open in Tiled';
});
