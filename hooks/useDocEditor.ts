import { useEditor } from '@tiptap/react'
import Placeholder from '@tiptap/extension-placeholder'

import { extensions } from 'editor/schema'
import CustomKeymap from 'editor/extensions/keymap'

function useDocEditor({
  initialContent,
  onContentChange,
  placeholder,
  onFocus,
}: {
  onFocus?: () => void,
  initialContent: string,
  /**
   * @param content in Markdown format
   * @returns
   */
  onContentChange: (content: string) => void,
  placeholder?: string
}) {
  const editor = useEditor({
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
      Placeholder.configure({
        placeholder: ({ editor }) => {
          if (!editor.getText()) {
            return placeholder || ''
          }
          return ''
        }
      }),
    ],
    onFocus({ editor }) {
      onFocus?.()
    },
    onCreate({ editor }) {
      editor?.commands.setContent(initialContent)
    },
    onUpdate({ transaction, editor }) {
      if (transaction.docChanged) {
        onContentChange(editor.storage.markdown.getMarkdown())
      }
    },
  }, [onContentChange, onFocus,])

  return editor
}

export default useDocEditor
