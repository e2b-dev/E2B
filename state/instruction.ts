import { JSONPath } from 'jsonpath-plus'

import { Reference } from 'editor/referenceType'
import { html2markdown } from 'editor/schema'

export type Instructions = any

export interface TransformType {
  type: 'xml'
}

export interface InstructionsTransform {
  [jsonPath: string]: TransformType | undefined
}

export function evaluateInstruction(instruction: Instructions, transformType?: TransformType['type']): [Instructions, Reference[]] {
  if (typeof instruction === 'string' && transformType === 'xml') {
    return html2markdown(instruction)
  }
  return [instruction, []]
}

export function transformInstructions(
  instructions: Instructions,
  instructionsTransform: InstructionsTransform,
  transform: (i: Instructions, transformType?: TransformType['type']) => Instructions,
) {
  let newInstructions = JSON.parse(JSON.stringify(instructions))

  Object.entries(instructionsTransform).forEach(([jsonPath, transformType]) => {
    JSONPath({
      path: jsonPath,
      json: newInstructions,
      callback: (payload, payloadType, fullPayload) => {
        const newPayload = transform(payload, transformType?.type)
        if (fullPayload.parent) {
          fullPayload.parent[fullPayload.parentProperty] = newPayload
        } else if (fullPayload.parent === null) {
          newInstructions = newPayload
        }
      }
    })
  })

  return newInstructions
}
