import { useLayoutEffect } from 'react'
import cn from 'clsx'
import { Package, Server } from 'lucide-react'

import useElement from 'hooks/useElement'
import Text from 'components/Text'
import { Reference, ReferenceType } from 'editor/referenceType'

export interface Props {
  selectItem: () => void
  isSelected: boolean
  item: Reference,
}

function getReferenceIcon(reference: Reference) {
  switch (reference.type) {
    case ReferenceType.DEPLOYMENT:
      return <Server size="16px" />
    case ReferenceType.NPMPackage:
      return <Package size="16px" />
    default:
      return null
  }
}

function Item({
  selectItem,
  isSelected,
  item,
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
        'py-0.5',
        'px-2',
        'py-1',
        'space-x-2',
        'shrink-0',
        'flex',
        'font-mono',
        'items-center',
        'group',
        'hover:text-slate-800',
        'overflow-ellipsis',
        'overflow-hidden',
        'cursor-pointer',
        {
          'text-slate-500': !isSelected,
          'bg-indigo-100 text-slate-800': isSelected,
        },
      )}
      onMouseDown={selectItem}
    >
      {getReferenceIcon(item)}
      <Text
        text={item.value}
      />
    </div >
  )
}

export default Item
