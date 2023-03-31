import { mergeAttributes, Node } from '@tiptap/core'
import { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { PluginKey } from '@tiptap/pm/state'

import attributeHandler from 'utils/attributeHandler'
import { Reference } from 'editor/referenceType'

import { SuggestionOptions } from './autocomplete/suggestion'


declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    reference: {
      setReference: (reference: Reference) => ReturnType,
    }
  }
}

export const REFERENCE_TYPE_ATTRIBUTE_NAME = 'reference-type'
export const REFERENCE_VALUE_ATTRIBUTE_NAME = 'reference-value'

export type ReferenceOptions = {
  HTMLAttributes: Record<string, any>
  renderLabel: (props: { options: ReferenceOptions; node: ProseMirrorNode }) => string
  suggestion: Omit<SuggestionOptions, 'editor'>
}

export const NODE_NAME = 'reference'
export const ReferencePluginKey = new PluginKey(NODE_NAME)

export default Node.create<ReferenceOptions>({
  name: NODE_NAME,
  addOptions() {
    return {
      HTMLAttributes: {
        class: NODE_NAME,
      },
      renderLabel({ node }) {
        return `${node.attrs[REFERENCE_VALUE_ATTRIBUTE_NAME]}`
      },
      suggestion: {
        pluginKey: ReferencePluginKey,
        command: ({ editor, range, props }) => {
          // increase range.to by one when the next node is of type "text"
          // and starts with a space character
          const nodeAfter = editor.view.state.selection.$to.nodeAfter
          const overrideSpace = nodeAfter?.text?.startsWith(' ')

          if (overrideSpace) {
            range.to += 1
          }

          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              {
                type: this.name,
                attrs: {
                  [REFERENCE_VALUE_ATTRIBUTE_NAME]: props.item.value,
                  [REFERENCE_TYPE_ATTRIBUTE_NAME]: props.item.type,
                },
              },
              {
                type: 'text',
                text: ' ',
              },
            ])
            .run()

          window.getSelection()?.collapseToEnd()
        },
        allow: ({ range, editor }) => {
          const state = editor.state
          const $from = state.doc.resolve(range.from)
          const type = state.schema.nodes[this.name]
          const allow = !!$from.parent.type.contentMatch.matchType(type)
          return allow
        },
      },
    }
  },

  group: 'inline',
  inline: true,
  selectable: false,
  atom: true,

  addAttributes() {
    return {
      ...attributeHandler({ nodeAttribute: REFERENCE_VALUE_ATTRIBUTE_NAME }),
      ...attributeHandler({ nodeAttribute: REFERENCE_TYPE_ATTRIBUTE_NAME }),
    }
  },

  parseHTML() {
    return [
      {
        tag: `span[data-type="${this.name}"]`,
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes({ 'data-type': this.name }, this.options.HTMLAttributes, HTMLAttributes),
      this.options.renderLabel({
        options: this.options,
        node,
      }),
    ]
  },

  renderText({ node }) {
    return this.options.renderLabel({
      options: this.options,
      node,
    })
  },

  addKeyboardShortcuts() {
    return {
      Backspace: () => this.editor.commands.command(({ tr, state }) => {
        let isReference = false
        const { selection } = state
        const { empty, anchor } = selection

        if (!empty) {
          return false
        }

        state.doc.nodesBetween(anchor - 1, anchor, (node, pos) => {
          if (node.type.name === this.name) {
            isReference = true
            tr.insertText(this.options.suggestion.char || '', pos, pos + node.nodeSize)

            return false
          }
        })

        return isReference
      }),
    }
  },
})
