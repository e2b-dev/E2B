import { useEditor } from '@tiptap/react'
import Placeholder from '@tiptap/extension-placeholder'
import Fuse from 'fuse.js'

import { Reference } from 'editor/referenceType'
import AutocompleteExtension from 'editor/extensions/autocomplete'
import { extensions } from 'editor/schema'

function useDocEditor({
  initialContent,
  onContentChange,
  placeholder,
  referenceSearch,
}: {
  referenceSearch: Fuse<Reference>
  initialContent: string,
  onContentChange: (content: string) => void,
  placeholder?: string
}) {
  const editor = useEditor({
    content: initialContent,
    parseOptions: {
      preserveWhitespace: 'full',
    },
    editorProps: {
      attributes: {
        'data-gramm': 'false',
        'spellcheck': 'false',
      },
    },
    extensions: [
      ...extensions,
      AutocompleteExtension.configure({
        suggestion: {
          items: query => referenceSearch.search(query).map(r => r.item),
        },
      }),
      Placeholder.configure({
        placeholder: ({ editor }) => {
          if (!editor.getText()) {
            return placeholder || ''
          }
          return ''
        }
      }),
    ],
    onUpdate({ transaction, editor }) {
      if (transaction.docChanged) {
        onContentChange(editor.getHTML())
      }
    },
  }, [onContentChange])

  return editor
}

export default useDocEditor
