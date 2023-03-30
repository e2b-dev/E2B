import { useEditor } from '@tiptap/react'
import Placeholder from '@tiptap/extension-placeholder'

import { extensions } from 'editor/schema'

function useDocEditor({
  initialContent,
  onContentChange,
  placeholder,
}: {
  initialContent: string,
  onContentChange: (content: string) => void,
  placeholder?: string
}) {
  const editor = useEditor({
    content: initialContent,
    parseOptions: {
      preserveWhitespace: 'full',
    },
    injectCSS: false,
    editorProps: {
      attributes: {
        'data-gramm': 'false',
        'spellcheck': 'false',
      },
    },
    extensions: [
      ...extensions,
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
