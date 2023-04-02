#!/usr/bin/env node
/* eslint-disable import/no-extraneous-dependencies */

const esbuild = require('esbuild')
const path = require('path')

const isDev = process.env.NODE_ENV === 'development'

const makeAllPackagesExternalPlugin = {
  name: 'make-all-packages-external',
  setup(build) {
    const filter = /^[^./]|^\.[^./]|^\.\.[^/]/ // Must not start with "/" or "./" or "../"
    build.onResolve({ filter }, (args) => ({
      path: args.path,
      external: true,
    }))
  },
}

esbuild
  .build({
    bundle: true,
    minify: !isDev,
    tsconfig: 'tsconfig.json',
    platform: 'node',
    target: 'node18',
    sourcemap: 'both',
    plugins: [makeAllPackagesExternalPlugin],
    outdir: 'lib',
    entryPoints: [path.join('src', 'server.ts')],
  })
  .catch(() => process.exit(1))
