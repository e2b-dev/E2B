import typescript from 'rollup-plugin-typescript2'
import babel from '@rollup/plugin-babel'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import autoExternal from 'rollup-plugin-auto-external'
import postcss from 'rollup-plugin-postcss';

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
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  plugins: [
    postcss({
      plugins: [],
    }),
    autoExternal({
      packagePath: 'package.json',
    }),
    resolve(),
    commonjs(),
    babel({
      presets: ["@babel/preset-react"],
      babelHelpers: 'bundled',
      exclude: 'node_modules/**'
    }),
    typescript({
      tsconfig: 'tsconfig.json',
    }),
    // TODO: Add terser
  ],
}
