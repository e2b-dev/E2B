import { useEditor } from '@tiptap/react'
import Placeholder from '@tiptap/extension-placeholder'
import Fuse from 'fuse.js'

import { Reference } from 'editor/referenceType'
import AutocompleteExtension from 'editor/extensions/autocomplete'
import { extensions } from 'editor/schema'
import CustomKeymap from 'editor/extensions/keymap'

function useDocEditor({
  initialContent,
  onContentChange,
  placeholder,
  referenceSearch,
}: {
  referenceSearch?: Fuse<Reference>
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
      CustomKeymap,
      ...referenceSearch ? [AutocompleteExtension.configure({
        suggestion: {
          items: query => referenceSearch.search(query),
        },
      })] : [],
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
