---
title: "From Tiled to PixiJS and back: editable maps in TypeScript"
published: true
description: "Load a Tiled map in PixiJS, edit its tiles at runtime, and export the result to continue working in Tiled."
tags: typescript, gamedev, javascript, opensource
cover_image: https://raw.githubusercontent.com/riebel/pixi-tiledmap/master/assets/devto-roundtrip/devto-cover.png
---

Open a map in Tiled. Build a bridge in the browser. Open the changed map in Tiled again.

![A map in the Tiled editor crossfades into the same map rendered by PixiJS in a browser. Four clicks build a bridge, the map is exported as level-edited.tmj, and Tiled opens it with the four new tiles highlighted on the Bridge layer.](https://raw.githubusercontent.com/riebel/pixi-tiledmap/master/assets/devto-roundtrip/pixi-tiledmap-roundtrip.gif)

I'm working on [pixi-tiledmap](https://github.com/riebel/pixi-tiledmap), a TypeScript library for loading, rendering, editing, and exporting Tiled maps with PixiJS v8. This post follows one small map through that whole loop. Every frame in the GIF comes from the real editor or the real demo. Only the pointer and the labels were added afterwards.

The map has two islands, four coins, and a missing bridge. It has three tile layers: `Terrain`, `Details`, and an empty `Bridge` layer. Keeping the edit on its own layer makes it easy to find after the export.

## Load the map

Install the library and PixiJS:

```sh
npm install pixi-tiledmap pixi.js
```

The following TypeScript runs in a browser project with a bundler. Serve `level.tmj` and its tileset image as static assets, and keep their relative paths.

```ts
import { Application } from 'pixi.js';
import { loadTiledMapAsset } from 'pixi-tiledmap';

const app = new Application();
await app.init({
  width: 864,
  height: 480,
  background: '#b8e1eb',
});
document.body.appendChild(app.canvas);

const { container: map } = await loadTiledMapAsset('./level.tmj');

// This example uses 128 px tiles, displayed at 48 px.
map.scale.set(0.375);
app.stage.addChild(map);
```

`loadTiledMapAsset` parses the map, resolves external tilesets and templates, loads the textures, and builds the PixiJS container. It accepts both `.tmj` and `.tmx` files.

## Edit tiles at runtime

The bridge takes four clicks. Each click calls `setTile` with a layer name, a column and row, and a tile from a named tileset:

```ts
map.setTile('Bridge', 7, 6, {
  tileset: 'platformer',
  tileId: 4,
});
```

The other three tiles go at columns 8, 9, and 10 of the same row. Coordinates and the tileset-local `tileId` are zero-based, and the library turns the local ID into Tiled's global ID for you.

`setTile` updates the rendered layer and the map data behind it. The export in the next step depends on that.

## Export back to Tiled

Add an export button:

```html
<button id="export">Export .tmj</button>
```

Then serialize the current map and download it as Tiled JSON:

```ts
import { exportMap } from 'pixi-tiledmap';

document.querySelector('#export')!.addEventListener('click', () => {
  const json = JSON.stringify(exportMap(map.mapData), null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = 'level-edited.tmj';
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
```

Put the downloaded file next to the original map and open it in Tiled. The four new tiles are on the `Bridge` layer, ready for more editing. The end of the GIF uses Tiled's *View › Highlight Current Layer*: with `Bridge` selected, everything else is dimmed and only the tiles added in the browser stay bright.

The `.tmj` contains the map data. It does not bundle the tileset images, so `platformer.png` has to sit next to the exported file, and maps with external tilesets also need those files at the paths they reference.

## Try it

The complete demo is in the repository as [`examples/tiled-roundtrip`](https://github.com/riebel/pixi-tiledmap/tree/master/examples/tiled-roundtrip), including the map and the CC0 tileset. You can run it in your browser without installing anything: [open the demo in StackBlitz](https://stackblitz.com/github/riebel/pixi-tiledmap/tree/master/examples/tiled-roundtrip?file=src/main.ts). If the StackBlitz preview blocks the download, open the preview in its own tab.

## What's under the hood

Three decisions make this work.

**Rendering and export share one map model.** `map.mapData` is the `ResolvedMap` that the renderer was built from: external references resolved, defaults filled in, tile references decoded. `setTile` writes into it, and `exportMap` reads from it, so there is no second copy to keep in sync. Parsing an exported map gives back a map that is deep-equal to the one you exported. Maps generated with `createMap` use the same model, so they can go through the same render, edit, and export steps.

**An edit writes one quad, not a layer.** Static tiles are batched into a few PixiJS meshes per layer rather than one sprite per tile. Each bridge click fills an empty cell on a static orthogonal layer, so the new tile becomes one more quad in the layer's packed mesh, and the layer is never rebuilt. Clearing a tile gives its slot back for the next insert. The frame of the [showcase](https://pixi-tiledmap-showcase.vercel.app/) in the README shows about 13,000 `setTile` calls per second on an animated 7,891-quad layer at 144 fps. A layer is rebuilt only when draw order depends on the edit, for example when inserting on isometric or hexagonal maps, or when a tile switches between static and animated. The [runtime editing docs](https://github.com/riebel/pixi-tiledmap#runtime-editing-and-procedural-maps) list every case.

**The export keeps what Tiled cares about.** A tileset that came from an external file is written back as a reference to that file, not embedded. Each tile layer keeps its CSV or base64 encoding. `nextlayerid` and `nextobjectid` are only ever raised, so IDs of layers and objects you deleted in Tiled are not handed out again.

## Limits

- Runtime per-tile alpha has no field in a Tiled tile layer, so it is not exported.
- Synchronous `exportMap` writes gzip or zlib layers as uncompressed base64. Use `exportMapAsync` to keep the compression.
- The export is always Tiled JSON, even when the source map was TMX.
- Game state such as inventory or physics stays in your application. The export covers the map.

## Where this helps

You can build a level editor into a PixiJS game, save a generated layout for hand-polishing in Tiled, or take a map that changed during play back into the editor to inspect it.

pixi-tiledmap is MIT-licensed and listed in [Tiled's Libraries and Frameworks documentation](https://doc.mapeditor.org/en/stable/reference/support-for-tmx-maps/#html5-multiple-engines). The [repository](https://github.com/riebel/pixi-tiledmap) has the API documentation, the supported features, and the benchmarks.

If you use Tiled with PixiJS, what would you want to change in the browser and bring back into the editor?

*Demo artwork: Kenney New Platformer Pack, CC0.*
