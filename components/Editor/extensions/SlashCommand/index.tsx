import {
  useImperativeHandle,
  useState,
  forwardRef,
  useCallback,
} from 'react'
import { ChainedCommands } from '@tiptap/core'


import { CommandList } from 'components/Editor/extensions/command/CommandListWrapper'

import Item from './Item'

interface CommandItem {
  title: string
  extendCommand: (cmd: ChainedCommands) => ChainedCommands
}

const items: CommandItem[] = [
  {
    title: '@slack/web-api',
    extendCommand: (cmd) => {
      return cmd
      // return cmd.set
      //   .setCodeCell({
      //     templateID: 'nextjs-v11-components',
      //     language: Lang.tsx,
      //   })
    },
  },
]

const SlashCommand: CommandList = forwardRef(({
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
        p-2
        w-56
        max-h-56

        flex
        flex-col
        flex-shrink-0

        overflow-y-auto
        overscroll-none

        rounded

        border
        border-slate-400

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

SlashCommand.displayName = 'SlashCommand'

export default SlashCommand
