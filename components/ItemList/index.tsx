import React, { useMemo } from 'react'

import Item, { ItemSetup } from './Item'

export interface Props {
  items: ItemSetup[]
  deleteItem?: (id: string) => Promise<void>
}

function AppList({ items, deleteItem }: Props) {
  const sorted = useMemo(
    () =>
      items.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [items],
  )

  return (
    <div
      className="
      scroller
      flex
      max-w-[800px]
      flex-1
      flex-col
      space-y-2
      overflow-auto
      pr-2
    "
    >
      {sorted.map(i => (
        <div
          className="flex flex-col space-y-2"
          key={i.id}
        >
          <Item item={i} deleteItem={deleteItem ? () => deleteItem(i.id) : undefined} />
          <div className="border-b border-slate-200" />
        </div>
      ))}
    </div>
  )
}

export default AppList