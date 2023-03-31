import {
  useImperativeHandle,
  useState,
  forwardRef,
  useCallback,
} from 'react'
import Item from './Item'
import { AutocompleteList } from './ListWrapper'

const Autocomplete: AutocompleteList = forwardRef(({
  items,
  command,
}, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)

  const selectItem = useCallback((index: number) => command(items[index]), [
    command,
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

  if (items.length === 0) {
    return null
  }

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
        border-slate-200
        border
        bg-slate-50
        shadow-md
        no-scroller
      "
    >
      {items.map((item, index) => (
        <Item
          key={item.refIndex}
          result={item}
          isSelected={index === selectedIndex}
          selectItem={() => selectItem(index)}
        />
      ))}
    </div>
  )
})

Autocomplete.displayName = 'Autocomplete'

export default Autocomplete
