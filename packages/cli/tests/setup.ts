import { execSync } from 'node:child_process'
import { beforeAll } from 'vitest'

beforeAll(() => {
  execSync('pnpm build', { stdio: 'inherit' })
})
