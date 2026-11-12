/**
 * Write the CLI reference to `sdk_ref/<command>.md`.
 *
 * Run with `pnpm run generate:reference`. e2b-dev/docs runs this to publish the
 * CLI reference for each `@e2b/cli` release.
 */
import fs from 'node:fs'
import path from 'node:path'

import { program } from 'src/commands'
import { renderReference } from './reference'

const outputDir = path.resolve('sdk_ref')
fs.rmSync(outputDir, { recursive: true, force: true })
fs.mkdirSync(outputDir, { recursive: true })

for (const [file, content] of renderReference(program)) {
  const filePath = path.join(outputDir, file)
  fs.writeFileSync(filePath, content)
  console.log(`Generated ${path.relative(process.cwd(), filePath)}`)
}
