import {
  useImperativeHandle,
  useState,
  forwardRef,
  useCallback,
} from 'react'
import { ChainedCommands } from '@tiptap/core'

import { Reference, ReferenceType } from 'editor/referenceType'

import Item from './Item'
import { AutocompleteList } from './ListWrapper'

interface AutocompleteItem {
  title: string
  extendCommand: (cmd: ChainedCommands) => ChainedCommands
}

function createAutocompleteItem(reference: Reference): AutocompleteItem {
  return {
    title: reference.value,
    extendCommand: (cmd) => cmd.setReference(reference)
  }
}

export const referenceItems: Reference[] = [
  {
    type: ReferenceType.NPMPackage,
    value: '@slack/web-api',
  },
  {
    type: ReferenceType.DEPLOYMENT,
    value: 'AWS Lambda',
  },
]

const items: AutocompleteItem[] = [
  ...referenceItems.map(createAutocompleteItem),
]

const Autocomplete: AutocompleteList = forwardRef(({
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
        border-indigo-300

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

Autocomplete.displayName = 'Autocomplete'

export default Autocomplete
