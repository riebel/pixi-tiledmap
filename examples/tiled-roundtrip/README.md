# Tiled round trip

Load a Tiled map with pixi-tiledmap, build a bridge by clicking the four gap cells, then export the edited map and open it in Tiled.

[Open in StackBlitz](https://stackblitz.com/github/riebel/pixi-tiledmap/tree/master/examples/tiled-roundtrip?file=src/main.ts)

```sh
npm install
npm run dev
```

The export downloads `level-edited.zip` with the map as Tiled JSON and the tileset image it references. A `.tmj` stores images only as paths, so unzip both into one folder and open `level-edited.tmj` in Tiled. If an embedded preview blocks the download, open the preview in its own tab.

Artwork: Kenney New Platformer Pack, CC0; see KENNEY-LICENSE.txt.
