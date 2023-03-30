import {
  useEffect,
  useState,
} from 'react'
import { Editor } from '@tiptap/react'
import Placeholder from '@tiptap/extension-placeholder'
import { keymap } from 'prosemirror-keymap'
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
  const [editor, setEditor] = useState<Editor | null>(null)

  useEffect(function initialize() {
    const instance = new Editor({
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
    })

    // Override default browser Ctrl/Cmd+S shortcut.
    instance.registerPlugin(keymap({
      'Mod-s': function () {
        return true
      },
    }))

    instance.on('transaction', t => {
      if (t.transaction.docChanged) {
        onContentChange(t.editor.getHTML())
      }
    })

    setEditor(instance)

    return () => {
      instance.destroy()
      setEditor(null)
    }
  }, [
    onContentChange,
    // We don't want the initialContent in the dependencies because that would reload the editor when we type.
  ])

  return editor
}

export default useDocEditor
