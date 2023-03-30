import { Node } from '@tiptap/core'
import {
  Editor as ReactEditor,
  ReactRenderer,
} from '@tiptap/react'
import tippy, {
  Instance,
  Props,
} from 'tippy.js'

import { destroyOnBackspace, destroyOnEsc } from 'editor/tippyPlugins'
import AutocompleteListWrapper, { AutocompleteList } from 'components/Editor/RouteEditor/PromptEditor/Autocomplete/ListWrapper'
import Autocomplete from 'components/Editor/RouteEditor/PromptEditor/Autocomplete'

import { Suggestion, SuggestionOptions, SuggestionProps } from './suggestion'
import reference from '../reference'

/**
 * Create bounding rect that starts at the caret position.
 */
function getReferenceClientRect(props: SuggestionProps): () => DOMRect {
  // TODO: Can we use props.decorationNode to simplify getting the rect
  return () => {
    const selection = props.editor.view.state.selection
    const anchor = props.editor.view.domAtPos(selection.anchor)
    const coords = props.editor.view.coordsAtPos(selection.anchor)

    const range = document.createRange()
    range.selectNodeContents(anchor.node)
    const rect = range.getBoundingClientRect()

    rect.x = coords.left

    return rect
  }
}

export type AutocompleteOptions = {
  list?: AutocompleteList
  suggestion: Omit<SuggestionOptions, 'editor'>
}

const autocomplete = Node.create<AutocompleteOptions>({
  name: 'autocomplete',
  addOptions() {
    return {
      suggestion: {
        // Check if the cursor is in a paragraph.
        allow: ({ editor: { state: { doc, selection } } }) =>
          doc.resolve(selection.anchor)?.parent?.type.name === 'paragraph',
        render: () => {
          let reactRenderer: any
          let popup: Instance<Props> | undefined
          let disabled = false

          return {
            onStart: props => {
              disabled = false
              reactRenderer = new ReactRenderer(AutocompleteListWrapper, {
                editor: props.editor as ReactEditor,
                props: {
                  ...props,
                  list: Autocomplete,
                },
              })

              const editorElement = props.editor.options.element

              popup = tippy(editorElement, {
                getReferenceClientRect: getReferenceClientRect(props),
                appendTo: () => document.body,
                content: reactRenderer.element,
                showOnCreate: true,
                interactive: true,
                hideOnClick: true,
                delay: 160,
                maxWidth: 'none',
                trigger: 'manual',
                offset: [1, 2],
                animation: false,
                placement: 'bottom-start',
                onHide() {
                  disabled = true
                  reactRenderer.destroy()
                },
                onDestroy() {
                  disabled = true
                  reactRenderer.destroy()
                },
                plugins: [destroyOnEsc, destroyOnBackspace],
              })
            },
            onUpdate(props) {
              if (disabled) return
              reactRenderer.updateProps(props)

              popup?.setProps({
                getReferenceClientRect: getReferenceClientRect(props),
              })
            },
            onKeyDown(props) {
              if (disabled) return false
              return reactRenderer?.ref?.onKeyDown(props)
            },
            onExit() {
              // Tippy.js throws the error:
              // `destroy() was called on an already-destroyed instance. This is a no-op but indicates a potential memory leak.`
              // only when you refresh the page and not when you navigate to it.
              // I suspect that the fast refresh in Next.js does not properly handle the popup when you refresh the page.
              popup?.destroy()
              reactRenderer.destroy()
            },
          }
        },
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        startOfLine: false,
        ...reference.options.suggestion,
        ...this.options.suggestion,
      }),
    ]
  },
})

export default autocomplete
