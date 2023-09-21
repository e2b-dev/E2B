import nodeResolve from '@rollup/plugin-node-resolve'
import replace from '@rollup/plugin-replace'
import autoExternal from 'rollup-plugin-auto-external'
import nodePolyfills from 'rollup-plugin-polyfill-node'
import typescript from 'rollup-plugin-typescript2'

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
      check: false, // uncomment when TS gives you weird erros when running vitest
    }),
    nodePolyfills(),
    nodeResolve({
      preferBuiltins: true,
      browser: true,
    }),
    // Beware: Using @rollup/plugin-json caused wrong structure of dist directory
    // It should be dist/cjs/*files* and with json plugin it's dist/cjs/src/*files*
    // That's why we opted for using replace plugin instead of importing package.json with json plugin
    replace({
      __pkgVersion__: pkg.version,
    }),
  ],
}
