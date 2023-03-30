import {
  useImperativeHandle,
  useState,
  forwardRef,
  useCallback,
} from 'react'
import Item from './Item'
import { AutocompleteList } from './ListWrapper'

const Autocomplete: AutocompleteList = forwardRef(({
  editor,
  range,
  items,
  command,
}, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)

  const selectItem = useCallback((index: number) => {
    const cmd = editor
      .chain()
      .deleteRange(range)

    command(items[index])

    // items[index]
    //   .extendCommand(cmd)
    //   .setTextSelection(0)
    //   .run()

  }, [
    range,
    command,
    editor,
    items,
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
    items.length,
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
        border-slate-300
        bg-slate-50
        shadow-md
      "
    >
      {items.map((item, index) => (
        <Item
          key={item.value}
          title={item.value}
          isSelected={index === selectedIndex}
          selectItem={() => selectItem(index)}
        />
      ))}
    </div>
  )
})

Autocomplete.displayName = 'Autocomplete'

export default Autocomplete
