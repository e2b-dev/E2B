import {
  useImperativeHandle,
  useState,
  forwardRef,
  useCallback,
} from 'react'
import { ChainedCommands } from '@tiptap/core'

import { CommandList } from 'components/Editor/extensions/command/CommandListWrapper'
import { PromptContext, promptContextItems } from 'editor/extensions/promptContext'

import Item from './Item'

interface CommandItem {
  title: string
  extendCommand: (cmd: ChainedCommands) => ChainedCommands
}

function createCommandItem(context: PromptContext): CommandItem {
  return {
    title: context.value,
    extendCommand: (cmd) => cmd.setPromptContext(context)
  }
}

const items: CommandItem[] = [
  ...promptContextItems.map(createCommandItem),
]

const ContextAutocomplete: CommandList = forwardRef(({
  editor,
  range,
}, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)

  const selectItem = useCallback((index: number) => {
    const cmd = editor
      .chain()
      .deleteRange(range)

    items[index]
      .extendCommand(cmd)
      .setTextSelection(0)
      .run()
  }, [
    range,
    editor,
  ])

  useImperativeHandle(ref, () => ({
    onKeyDown({ event }) {
      if (event.key === 'ArrowUp') {
        setSelectedIndex(i => ((i + items.length) - 1) % items.length)
        return true
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex(i => (i + 1) % items.length)
        return true
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex)
        return true
      }
      return false
    },
  }), [
    selectedIndex,
    selectItem,
  ])

  return (
    <div
      className="
        w-56
        max-h-56

        flex
        flex-col
        shrink-0

        overflow-y-auto
        overscroll-none
        rounded

        border
        border-indigo-400

        bg-white
      "
    >
      {items.map((item, index) => (
        <Item
          key={item.title}
          title={item.title}
          isSelected={index === selectedIndex}
          selectItem={() => selectItem(index)}
        />
      ))}
    </div>
  )
})

ContextAutocomplete.displayName = 'ContextAutocomplete'

export default ContextAutocomplete
