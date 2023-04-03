import Text from 'components/Text'
import { html2markdown } from 'editor/schema'
import { useMemo } from 'react'
import { useStateStore } from 'state/StoreProvider'

export interface Props {
}

function Context({

}: Props) {
  const [selector] = useStateStore()
  const routes = selector.use.routes()
  const references = useMemo(() => routes
    .flatMap(r => r.blocks)
    .filter(b => b.type === 'Instructions' || b.type === 'Description')
    .flatMap(b => {
      const [, references] = html2markdown(b.content)
      return references
    }).filter((reference, index, self) =>
      index === self.findIndex((r) => (
        r.type === reference.type && r.value === reference.value
      ))
    )
    , [routes])

  return (
    <div className="
      max-w-full
      flex
      flex-col
      overflow-hidden
      ">
      <div className="
        flex
        bg-slate-50
        items-center
        justify-between
        border-b
        py-3.5
        pr-4
      ">
        <Text
          text="Context"
          size={Text.size.S2}
          className="
            uppercase
            text-slate-400
            font-semibold
            px-4
          "
        />
      </div>
      <div className="
        flex
        flex-1
        flex-col
        space-y-2
      ">
        {references.map(r =>
          <div
            key={r.type + '/' + r.value}
          >
            {r.type}
            {r.value}
          </div>
        )}
      </div>
    </div>
  )
}

export default Context
