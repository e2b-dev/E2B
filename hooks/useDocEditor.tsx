import {
  useEffect,
  useState,
} from 'react'
import { Editor } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { keymap } from 'prosemirror-keymap'

// import SlashCommand from 'src/editor/extensions/slashCommand'

function useDocEditor({
  initialContent,
  onContentChange,
}: {
  initialContent: string,
  onContentChange: (content: string) => void,
}) {
  const [editor, setEditor] = useState<Editor>()

  useEffect(function initialize() {
    const extensions = [
      StarterKit.configure({
        blockquote: false,
        bold: false,
        bulletList: false,
        code: false,
        codeBlock: false,
        dropcursor: false,
        hardBreak: false,
        heading: false,
        horizontalRule: false,
        italic: false,
        listItem: false,
        strike: false,
        orderedList: false,
      }),
      Placeholder.configure({
        placeholder: "Type '/' for commands",
      }),
      // SlashCommand,
    ]

    const instance = new Editor({
      content: initialContent,
      parseOptions: {
        preserveWhitespace: 'full',
      },
      injectCSS: false,
      editorProps: {
        attributes: {
          'data-gramm': 'false',
          // 'spellcheck': 'false',
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
        onContentChange(u.transaction.doc.toJSON())
      }
    })

    setEditor(instance)

    return () => {
      instance.destroy()
      setEditor(undefined)
    }
  }, [
    onContentChange,
  ])

  return editor
}

export default useDocEditor
