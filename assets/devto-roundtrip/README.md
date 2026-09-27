# Tiled → PixiJS → Tiled recording

Material for the dev.to article in `devto-article.md`. The runnable version of the demo, for StackBlitz, is `examples/tiled-roundtrip`.

Run from the repository root:

```sh
npx tsdown
node assets/devto-roundtrip/prepare.mjs
node assets/devto-roundtrip/capture-browser.mjs
cp assets/devto-roundtrip/frames/export/level-edited.tmj assets/devto-roundtrip/
pwsh assets/devto-roundtrip/capture-tiled.ps1
python assets/devto-roundtrip/compose.py   # needs Pillow
```

- `prepare.mjs` writes `level.tmj` and bundles `main.ts` into `bundle.js`.
- `capture-browser.mjs` drives the demo in headless Chrome (SwiftShader) over CDP: four real clicks on the bridge cells and a real export click. It saves one capture per state and the downloaded `level-edited.tmj`. The export was checked to contain exactly the four Bridge tiles at (7..10, 6).
- `capture-tiled.ps1` opens the maps in Tiled 1.12.2 with the Bridge layer selected and captures the window in physical pixels: `level.tmj`, the exported `level-edited.tmj`, and the same file with *View › Highlight Current Layer* on. It is set up for this machine (150 % scaling on the second 4K display) and restores Tiled's session file and registry preferences afterwards.
- `compose.py` builds `pixi-tiledmap-roundtrip.gif` (1000×792, ~14 s loop, ~1.6 MB) and `devto-cover.png` (1000×420).

The map is at the same pixel position and size (864×480) in the Tiled and browser captures, so the crossfades change only the tool around it. The browser crop leaves out the page heading. Everything inside the window frames is captured pixels. Drawn in post: the header, the window labels, the code line, the pointer and click ripples, the flying file chip, the Layers panel placed over the map view (a crop of Tiled's own Layers dock), and the green outline around the bridge.

Artwork: Kenney New Platformer Pack, CC0; see KENNEY-LICENSE.txt.
