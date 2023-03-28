import {
  useEffect,
  useState,
} from 'react'
import { createDocument, Editor, getSchema } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { keymap } from 'prosemirror-keymap'
import { defaultMarkdownSerializer } from 'prosemirror-markdown'

import ContextAutocomplete from 'editor/extensions/contextAutocomplete'

const extensions = [
  StarterKit.configure({
    blockquote: false,
    bold: false,
    bulletList: false,
    // code: false,
    // codeBlock: false,
    dropcursor: false,
    hardBreak: false,
    // heading: false,
    horizontalRule: false,
    italic: false,
    // listItem: false,
    strike: false,
    // orderedList: false,
  }),
  ContextAutocomplete,
]

const schema = getSchema(extensions)

export function getPromptText(structuredProse: string) {
  const node = createDocument(structuredProse, schema)
  const markdown = defaultMarkdownSerializer.serialize(node)
  console.log(markdown)
  return markdown
}

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
        // onContentChange(t.transaction.doc.toJSON())
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
    //  initialContent
  ])

  return editor
}

export default useDocEditor
