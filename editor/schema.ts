import { StarterKit } from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import { Reference } from './referenceType'

export const extensions = [
  StarterKit,
  Markdown,
]

// Placeholder function until we delete all depending code
export function html2markdown(html: string): [string, Reference[]] {
  return ['', []]
}
