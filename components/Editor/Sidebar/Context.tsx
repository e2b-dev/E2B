import Text from 'components/Text'
import { useStateStore } from 'state/StoreProvider'

export interface Props {
}

function Context({

}: Props) {
  const [selector] = useStateStore()


  return (
    <div className="
      max-w-full
      flex
      flex-col
      bg-slate-50
      overflow-hidden
    ">
      <div className="
        flex
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
    </div>
  )
}

export default Context
