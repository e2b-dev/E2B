import { mergeAttributes, Node } from '@tiptap/core'
import { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { PluginKey } from '@tiptap/pm/state'

import attributeHandler from 'utils/attributeHandler'

import { Suggestion, SuggestionOptions } from './command'

export enum PromptContextType {
  NPMPackage = 'NPM_PACKAGE',
  DEPLOYMENT = 'DEPLOYMENT_SERVICE',
}

export interface PromptContext {
  type: PromptContextType
  value: string
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    promptContext: {
      setPromptContext: (context: PromptContext) => ReturnType,
    }
  }
}

export const CONTEXT_VALUE_ATTRIBUTE_NAME = 'context-value'
export const CONTEXT_TYPE_ATTRIBUTE_NAME = 'context-type'

export const promptContextItems: PromptContext[] = [
  {
    type: PromptContextType.NPMPackage,
    value: '@slack/web-api',
  },
  {
    type: PromptContextType.DEPLOYMENT,
    value: 'AWS Lambda',
  },
]

export type MentionOptions = {
  HTMLAttributes: Record<string, any>
  renderLabel: (props: { options: MentionOptions; node: ProseMirrorNode }) => string
  suggestion: Omit<SuggestionOptions, 'editor'>
}

export const PromptContextPluginKey = new PluginKey('promptContext')

export default Node.create<MentionOptions>({
  name: 'promptContext',

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'prompt-context',
      },
      renderLabel({ options, node }) {
        return `${node.attrs[CONTEXT_VALUE_ATTRIBUTE_NAME]}`
      },
      suggestion: {
        pluginKey: PromptContextPluginKey,
        command: ({ editor, range, props }) => {
          console.log('Command >>>')
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
                attrs: props,
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
      ...attributeHandler({ nodeAttribute: CONTEXT_VALUE_ATTRIBUTE_NAME }),
      ...attributeHandler({ nodeAttribute: CONTEXT_TYPE_ATTRIBUTE_NAME }),
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
        let isMention = false
        const { selection } = state
        const { empty, anchor } = selection

        if (!empty) {
          return false
        }

        state.doc.nodesBetween(anchor - 1, anchor, (node, pos) => {
          if (node.type.name === this.name) {
            isMention = true
            tr.insertText(this.options.suggestion.char || '', pos, pos + node.nodeSize)

            return false
          }
        })

        return isMention
      }),
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ]
  },
})
  .extend({
    addCommands() {
      return {
        setPromptContext: (context) => ({ commands, state }) => {
          return commands
            .setContent([
              {
                type: this.name,
                attrs: {
                  [CONTEXT_TYPE_ATTRIBUTE_NAME]: context.type,
                  [CONTEXT_VALUE_ATTRIBUTE_NAME]: context.value,
                },
              },
              {
                type: 'text',
                text: ' ',
              },
            ])
        },
      }
    },
  })
