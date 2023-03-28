import {
  useEffect,
  useReducer,
  useState,
} from 'react'
import { createDocument, Editor, getSchema } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { keymap } from 'prosemirror-keymap'

import SlashCommand from 'editor/extensions/slashCommand'

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
    placeholder: 'All You Need Is English',
  }),
  SlashCommand,
]

const schema = getSchema(extensions)

export function getPromptText(structuredProse: string) {
  const node = createDocument(structuredProse, schema)

  let text = ''

  node.descendants(n => {
    text += n.content
  })

  return text
}

function useDocEditor({
  initialContent,
  onContentChange,
}: {
  initialContent: string,
  onContentChange: (content: string) => void,
}) {
  const [editor, setEditor] = useState<Editor | null>(null)

  const forceUpdate = useReducer(() => ({}), {})[1]

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
      extensions,
    })

    // Override default browser Ctrl/Cmd+S shortcut.
    instance.registerPlugin(keymap({
      'Mod-s': function () {
        return true
      },
    }))

    instance.on('transaction', t => {
      if (t.transaction.docChanged) {
        onContentChange(t.transaction.doc.toJSON())
      }

      // requestAnimationFrame(() => {
      //   requestAnimationFrame(() => {
      //     forceUpdate()
      //   })
      // })
    })

    setEditor(instance)

    return () => {
      instance.destroy()
      setEditor(null)
    }
  }, [
    onContentChange,
    forceUpdate,
    // We don't want the initialContent in the dependencies because that would reload the editor when we type.
    //  initialContent
  ])

  return editor
}

export default useDocEditor
