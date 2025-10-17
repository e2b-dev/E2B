import { execSync } from 'node:child_process'

export async function setup() {
  execSync('pnpm build', { stdio: 'inherit' })
}
