
import { html2markdown } from 'editor/schema'
import { Reference } from 'editor/referenceType'

import { evaluateInstruction, Instructions, InstructionsTransform, transformInstructions } from './instruction'

export function getPromptLabel(fragment: PromptFragment) {
  if (fragment.role === 'system' && fragment.type === 'prefix') {
    return 'Specify model\'s behavior for the whole run'
  }
  if (fragment.role === 'system' && fragment.type === 'suffix') {
    return 'Specify how the model should call tools (like WriteJavaScriptCode)'
  }
  if (fragment.role === 'user' && fragment.type === 'prefix') {
    // https://github.com/janl/mustache.js#templates add docs ref
    return 'Describe the context and the start of the task the model should do.\nTo use information from the user prompt (like the steps from "Step-by-step instructions") add them like this: `{{Instructions}}`.\nYou can add Description, RequestBody, Instructions, Method, and Route this way.'
  }
  return ''
}

export interface PromptFragment {
  role: 'user' | 'system'
  type: string
  /**
   * By default the content is in XML format and we have to transform it before sending it in a request to backend.
   */
  content: string
}


export function evaluateInstructions(
  instructions: Instructions,
  instructionsTransform: InstructionsTransform,
) {

  const references: Reference[] = []

  const instructionsView = transformInstructions(
    instructions,
    instructionsTransform,
    (i, type) => {
      const [markdown, references] = evaluateInstruction(i, type)
      references.push(...references)
      return markdown
    })

  return {
    references,
    instructions: instructionsView,
  }
}

export function evaluatePrompt(
  prompt: PromptFragment[],
) {
  const references: Reference[] = []

  const textualPrompt = prompt
    .map(p => {
      const [markdown, references] = html2markdown(p.content)
      references.push(...references)
      return {
        ...p,
        content: markdown,
      }
    })

  return {
    prompt: textualPrompt,
    references,
  }
}
