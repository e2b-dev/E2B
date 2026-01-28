import { randomUUID } from 'node:crypto'

export const AUTHOR_NAME = 'Sandbox Bot'
export const AUTHOR_EMAIL = 'sandbox@example.com'
export const USERNAME = 'git'
export const PASSWORD = 'token'
export const HOST = 'example.com'
export const PROTOCOL = 'https'

const BASE_DIR = '/tmp/test-git'

export async function createBaseDir(sandbox: any) {
  const baseDir = `${BASE_DIR}/${randomUUID()}`
  await sandbox.commands.run(`rm -rf "${baseDir}" && mkdir -p "${baseDir}"`)
  return baseDir
}

export async function cleanupBaseDir(sandbox: any, baseDir: string) {
  await sandbox.commands.run(`rm -rf "${baseDir}"`)
}

export async function createRepo(sandbox: any, baseDir: string) {
  const repoPath = `${baseDir}/repo`
  await sandbox.git.init(repoPath, { initialBranch: 'main' })
  return repoPath
}

export async function createRepoWithCommit(sandbox: any, baseDir: string) {
  const repoPath = await createRepo(sandbox, baseDir)
  await sandbox.files.write(`${repoPath}/README.md`, 'hello\n')
  await sandbox.git.add(repoPath)
  await sandbox.git.commit(repoPath, 'Initial commit', {
    authorName: AUTHOR_NAME,
    authorEmail: AUTHOR_EMAIL,
  })
  return repoPath
}

export async function startGitDaemon(sandbox: any, baseDir: string) {
  const remotePath = `${baseDir}/remote.git`
  await sandbox.commands.run(
    `git init --bare --initial-branch=main "${remotePath}"`
  )
  const port = 9418 + Math.floor(Math.random() * 1000)
  const handle = await sandbox.commands.run(
    `git daemon --reuseaddr --base-path="${baseDir}" --export-all ` +
    `--enable=receive-pack --informative-errors --listen=127.0.0.1 --port=${port}`,
    { background: true }
  )
  await sandbox.commands.run('sleep 1')
  return {
    handle,
    remotePath,
    remoteUrl: `git://127.0.0.1:${port}/remote.git`,
    port,
  }
}
