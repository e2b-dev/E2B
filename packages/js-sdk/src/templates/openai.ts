import type { Run, RunSubmitToolOutputsParams } from 'openai/resources/beta/threads/runs/runs'

import type { Sandbox } from '../sandbox'


export class Actions {
  constructor(private readonly sandbox: Sandbox) { }

  /**
   * Call the required actions for the provided run and return their outputs.
   * 
   * @param run OpenAI run object from `openai.beta.threads.runs.retrieve` or `openai.beta.threads.runs.retrieve.create` call that contains the names of the required actions and their arguments.
   * @returns The outputs of the required actions in the run.
   */
  async run(run: Run): Promise<RunSubmitToolOutputsParams.ToolOutput[]> {
    if (run.status !== 'requires_action') {
      return []
    }

    if (!run.required_action) {
      return []
    }

    const outputs: RunSubmitToolOutputsParams.ToolOutput[] = []

    for (const toolCall of run.required_action.submit_tool_outputs.tool_calls) {
      const action = this.sandbox._actions.get(toolCall.function.name)
      if (!action) {
        console.warn(`Action ${toolCall.function.name} not found`)
        continue
      }

      const args = JSON.parse(toolCall.function.arguments)
      const output = await action(this.sandbox, args)

      outputs.push({
        tool_call_id: toolCall.id,
        output,
      })
    }

    return outputs
  }
}
