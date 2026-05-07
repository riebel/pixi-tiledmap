# MagicLand visual fixture

This fixture captures the MagicLand TMX map used to catch packed tile renderer regressions:

- `MagicLand.tmx`: real TMX map fixture
- `magiclanddizzy_tiles.gif`: real GIF tileset atlas referenced by the map
- `reference-render-1000x700.png`: known-good render of the example app at a `1000x700` viewport

Use the reference render as a quick visual comparison when changing tile layer packing, TMX loading, texture atlas slicing, render order, flip flags, or GIF tileset handling.

The reference was captured from `http://127.0.0.1:5173/` with the example project loading `/MagicLand.tmx` through `tiledMapLoader`.

The render is verified completely headlessly as part of the normal test suite:

```sh
npm test
```

The verifier captures the same `1000x700` viewport and compares it with `reference-render-1000x700.png`. Set `CHROME_PATH` or `MAGICLAND_MAX_DIFF_PIXELS` when running against a different local setup.
The Vitest case uses the package built by `npm test`, starts its own temporary local fixture server, renders the map in headless Chrome/Edge, and shuts the server down after the comparison.
