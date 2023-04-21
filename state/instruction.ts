import mapValues from 'lodash.mapvalues'

import { Reference } from 'editor/referenceType'
import { html2markdown } from 'editor/schema'

export interface Instruction {
  type: 'text' | 'xml'
  // `content` must be valid XML when `type` is `xml`
  content: string
}

export type NestedInstruction =
  undefined |
  Instruction |
  Instruction[] |
  InstructionsRoot |
  InstructionsRoot[]

export interface InstructionsRoot {
  [key: string]: NestedInstruction
}

export function evaluateInstruction(instruction: Instruction): [string, Reference[]] {
  if (instruction.type === 'xml') {
    return html2markdown(instruction.content)
  }
  return [instruction.content, []]
}

export function isInstruction(value: Instruction | InstructionsRoot): value is Instruction {
  return value.content !== undefined && value.type !== undefined
}

export function mapNestedInstructions(instructions: InstructionsRoot, transform: (i: Instruction) => string) {
  function transformValues(i: Instruction | InstructionsRoot): any {
    return isInstruction(i)
      ? transform(i)
      : mapNestedInstructions(i, transform)
  }

  return mapValues(instructions, (value, key) => {
    if (!value) return
    return Array.isArray(value)
      ? value.map(transformValues)
      : transformValues(value)
  })
}