import { useLayoutEffect } from 'react'
import cn from 'clsx'
import { Package } from 'lucide-react'

import useElement from 'hooks/useElement'
import { Reference, ResultType, ReferenceType } from 'editor/referenceType'
import HighlightedText from './HighlightedText'

export interface Props {
  selectItem: () => void
  isSelected: boolean
  result: ResultType
}

function getReferenceIcon(reference: Reference) {
  switch (reference.type) {
    case ReferenceType.NPMPackage:
      return <Package size="16px" />
    default:
      return null
  }
}

function Item({
  selectItem,
  isSelected,
  result,
}: Props) {
  const [scrollEl, setScrollRef] = useElement<HTMLDivElement>()

  useLayoutEffect(function scrollToItem() {
    if (scrollEl && isSelected) {
      scrollEl.scrollIntoView({
        block: 'nearest',
      })
    }
  }, [isSelected, scrollEl])

  return (
    <div
      ref={setScrollRef}
      className={cn(
        'px-2',
        'py-1',
        'space-x-2',
        'shrink-0',
        'flex',
        'text-sm',
        'font-mono',
        'items-center',
        'group',
        'hover:bg-indigo-100',
        'overflow-ellipsis',
        'overflow-hidden',
        'text-slate-600',
        'cursor-pointer',
        {
          'bg-indigo-100': isSelected,
        },
      )}
      onMouseDown={selectItem}
    >
      {getReferenceIcon(result.item)}
      <HighlightedText
        text={result.item.value}
        ranges={result.matches?.flatMap(i => i.indices)}
      />
    </div >
  )
}

export default Item
