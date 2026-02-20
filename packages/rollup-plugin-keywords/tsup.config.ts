import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    clean: true,
    dts: {
      resolve: true,
    },
    sourcemap: true,
    splitting: false,
    format: ['cjs', 'esm'],
  },
  {
    entry: ['src/cli.ts'],
    clean: false, // Don't clean again if the first config already did
    dts: false,
    sourcemap: true,
    splitting: false,
    format: ['esm'],
  },
]);
