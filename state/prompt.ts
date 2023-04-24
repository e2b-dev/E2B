import Mustache from 'mustache'

import { html2markdown } from 'editor/schema'
import { Reference } from 'editor/referenceType'
import { identity } from 'utils/identity'

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

export function evaluatePrompt(
  instructions: Instructions,
  instructionsTransform: InstructionsTransform,
  prompt: PromptFragment[],
): PromptFragment[] {
  const references: Reference[] = []

  const instructionsView = transformInstructions(
    instructions,
    instructionsTransform,
    (i, type) => {
      const [markdown, references] = evaluateInstruction(i, type)
      references.push(...references)
      return markdown
    })

  const textualPrompt = prompt
    .map(p => {
      const [markdown, references] = html2markdown(p.content)
      references.push(...references)
      return {
        ...p,
        content: markdown,
      }
    })
    .map(p => {
      return {
        ...p,
        content: Mustache.render(p.content, {
          // TODO: Use the references to build context
          References: references,
          ...instructionsView,
        }, undefined, {
          escape: identity,
        }),
      }
    })


  console.log('Prompt:', textualPrompt)
  console.log('Instructions view:', instructionsView)
  return textualPrompt
}
