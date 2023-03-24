import {
  useEffect,
  useState,
} from 'react'
import { Editor } from '@tiptap/react'
import Placeholder from '@tiptap/extension-placeholder'
import { keymap } from 'prosemirror-keymap'


import SlashCommand from 'src/editor/extensions/slashCommand'

function useDocumentEditor({
  initialContent,
  onContentChange,
}: {
  initialContent: string,
  onContentChange: (content: string) => void,
}) {
  const [editor, setEditor] = useState<Editor>()

  useEffect(function initialize() {
    const extensions = [
      Document,
      Paragraph,
      Text,
      Placeholder.configure({
        placeholder: "Type '/' for commands",
      }),
      SlashCommand,
    ]

    // Transform content

    const instance = new Editor({
      content,
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
      extensions,
    })

    // Override default browser Ctrl/Cmd+S shortcut.
    instance.registerPlugin(keymap({
      'Mod-s': function () {
        return true
      },
    }))

    instance.on('update', u => {
      if (u.transaction.docChanged) {
        // TODO: Handle prompt extraction
        const prompt = u.transaction.doc.text
        onContentChange(prompt)
      }
    })

    setEditor(instance)

    return () => {
      instance.destroy()
      setEditor(undefined)
    }
  }, [
    initialContent,
    onContentChange,
  ])

  return editor
}

export default useDocumentEditor
