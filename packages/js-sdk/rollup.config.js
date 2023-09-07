import json from '@rollup/plugin-json'
import nodeResolve from '@rollup/plugin-node-resolve'
import autoExternal from 'rollup-plugin-auto-external'
import nodePolyfills from 'rollup-plugin-polyfill-node'
import typescript from 'rollup-plugin-typescript2'
import webWorkerLoader from 'rollup-plugin-web-worker-loader'

import pkg from './package.json'

export default {
  input: 'src/index.ts',
  output: [
    {
      name: pkg.name,
      file: pkg.umd,
      format: 'umd',
      sourcemap: true,
    },
    {
      name: pkg.name,
      file: pkg.main,
      format: 'cjs',
      sourcemap: true,
      exports: 'auto',
    },
    {
      name: pkg.name,
      file: pkg.module,
      format: 'es',
      sourcemap: true,
    },
  ],
  external: ['cross-fetch', 'cross-fetch/polyfill'],
  plugins: [
    autoExternal({ builtins: false }),
    typescript({
      clean: false,
    }),
    nodePolyfills(),
    nodeResolve({
      preferBuiltins: true,
      browser: true,
    }),
    webWorkerLoader({
      inline: false, // output separate file
      external: [], // no external dependencies
    }),
    json(),
  ],
}
