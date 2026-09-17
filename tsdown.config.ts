import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  unbundle: true,
  deps: { neverBundle: ['pixi.js'] },
  // A dynamic import() in CommonJS output loads the ESM build of pixi.js, a
  // second instance beside the require()d one the renderer uses. Advanced
  // blend modes registered there never reach the renderer.
  outputOptions: (options, format) =>
    format === 'cjs' ? { ...options, dynamicImportInCjs: false } : options
})
