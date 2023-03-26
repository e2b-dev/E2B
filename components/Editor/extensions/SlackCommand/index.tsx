import {
  useImperativeHandle,
  useState,
  forwardRef,
  useCallback,
} from 'react'
import { ChainedCommands } from '@tiptap/core'

import { CommandList } from 'components/Editor/extensions/command/CommandListWrapper'
import { Lang } from 'editor/extensions/codeCell/language'

import Item from './Item'

interface CommandItem {
  title: string
  extendCommand: (cmd: ChainedCommands) => ChainedCommands
}

const items: CommandItem[] = [
  {
    title: 'Next.js Code Cell',
    extendCommand: (cmd) => {
      return cmd
        .setCodeCell({
          templateID: 'nextjs-v11-components',
          language: Lang.tsx,
        })
    },
  },
  {
    title: 'Node.js Code Cell',
    extendCommand: (cmd) => {
      return cmd
        .setCodeCell({
          templateID: 'nodejs-v16',
          language: Lang.ts,
        })
    },
  },
  {
    title: 'Shell Command (Next.js)',
    extendCommand: (last) => {
      return last.setCodeCell({
        templateID: 'nextjs-v11-components',
        language: Lang.sh,
      })
    },
  },
  {
    title: 'Shell Command (Node.js)',
    extendCommand: (last) => {
      return last.setCodeCell({
        templateID: 'nodejs-v16',
        language: Lang.sh,
      })
    }
  },
  {
    title: 'Iframe Cell',
    extendCommand: (cmd) => {
      return cmd
        .focus()
        .setIframe({ src: 'https://usedevbook.com' })
    },
  },
  {
    title: 'Console Cell',
    extendCommand: (cmd) => {
      return cmd
        .focus()
        .setConsoleCell()
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
        p-1.5
        w-56
        max-h-56

        flex
        flex-col
        flex-shrink-0

        overflow-y-auto
        overscroll-none

        rounded

        border
        dark:border-black-600
        border-gray-500

        bg-gray-300
        dark:bg-black-650

        shadow-lg
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