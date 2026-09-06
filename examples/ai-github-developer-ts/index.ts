import { Sandbox } from '@e2b/code-interpreter'
import { Octokit } from '@octokit/rest'
import * as dotenv from 'dotenv'

dotenv.config()

export interface DevTask {
  repo: string
  issueNumber: number
  instructions: string
}

export class AIGitHubDeveloper {
  private octokit: Octokit

  constructor(githubToken: string) {
    this.octokit = new Octokit({ auth: githubToken })
  }

  async runTask(task: DevTask): Promise<string> {
    console.log(`[AI-Dev] Starting execution for ${task.repo} #${task.issueNumber}`)
    
    // 1. Initialize secure cloud sandbox
    const sandbox = await Sandbox.create()
    try {
      console.log(`[AI-Dev] E2B Sandbox initialized: ${sandbox.sandboxId}`)

      // 2. Clone repository into the sandbox environment
      const cloneCmd = await sandbox.commands.run(`git clone https://github.com/${task.repo}.git /repo`)
      if (cloneCmd.exitCode !== 0) {
        throw new Error(`Failed to clone repository: ${cloneCmd.stderr}`)
      }

      // 3. Inspect repository state
      const execResult = await sandbox.commands.run(`cd /repo && git status`)
      console.log(`[AI-Dev] Workspace status:\n${execResult.stdout}`)

      return `Task completed in sandbox ${sandbox.sandboxId}`
    } finally {
      await sandbox.kill()
    }
  }
}
