import OpenAI from 'openai'
import { Sandbox, SandboxOpts } from '../'
import { RunSubmitToolOutputsParams } from 'openai/resources/beta/threads/runs/runs'

export interface Action<T = { [key: string]: any }> {
  (sandbox: Sandbox, args: T): string | Promise<string>
}

export class ActionSandbox extends Sandbox {
  readonly openai = {
    assistant: {
      run: async (run: OpenAI.Beta.Threads.Runs.Run): Promise<RunSubmitToolOutputsParams.ToolOutput[]> => {
        if (run.status !== 'requires_action') {
          return []
        }
        
        if (!run.required_action) {
          return []
        }

        const outputs: RunSubmitToolOutputsParams.ToolOutput[] = []
        
        for (const toolCall of run.required_action.submit_tool_outputs.tool_calls) {
          const action = this.actions.get(toolCall.function.name)
          if (!action) {
            continue
          }

          const args = JSON.parse(toolCall.function.arguments)
          const output = await action(this, args)

          outputs.push({
            tool_call_id: toolCall.id,
            output,
          })
        }

        return outputs
      },
    } as const,
  } as const

  private actions: Map<string, Action<any>> = new Map()

  static override async create(opts: SandboxOpts) {
    const sandbox = new this(opts)
    await sandbox._open({ timeout: opts?.timeout })
    if (opts?.cwd) {
      await sandbox.filesystem.makeDir(opts.cwd)
    }
    return sandbox
  }

  registerAction<T = { [name: string]: any }>(name: string, action: Action<T>) {
    this.actions.set(name, action)

    return this
  }
}
