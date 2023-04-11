import Radio from 'components/Radio'
import Text from 'components/Text'
import { useStateStore } from 'state/StoreProvider'
import { models } from 'state/model'

export interface Props { }

function Context({ }: Props) {
  const [selector] = useStateStore()

  const model = selector.use.model()
  const setModel = selector.use.setModel()

  return (
    <div className="
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
          text="Model"
          size={Text.size.S2}
          className="
            uppercase
            text-slate-400
            font-semibold
            px-4
          "
        />
      </div>
      <div
        className="
        flex
        flex-1
        space-y-2
        p-4
        flex-col
        items-stretch
      "
      >
        {Object.entries(models).map(([provider, value]) =>
          <div
            key={provider}
          >
            <Text
              text={provider}
              className="
              font-semibold
              uppercase
              text-slate-400
            "
              size={Text.size.S3}
            />
            <div className="
              flex
              items-start
              flex-1
              py-1
            "
            >
              <Radio
                items={value.models.map(m => m.name)}
                getLabel={item => value.models.find(m => m.name === item)?.name}
                select={setModel}
                selected={model}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Context
