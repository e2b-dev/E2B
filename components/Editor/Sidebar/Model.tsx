import * as RadioGroup from '@radix-ui/react-radio-group'

import Text from 'components/Text'
import { useStateStore } from 'state/StoreProvider'
import { ModelName } from 'state/store'

export interface Props {
}

function Context({
}: Props) {
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
      "
      >
        <Text
          text="OpenAI"
          className="
          font-semibold
          uppercase
          text-slate-400
        "
          size={Text.size.S3}
        />
        <RadioGroup.Root
          className="flex flex-col gap-2.5"
          value={model}
          onValueChange={(v) => setModel(v as ModelName)}
          defaultChecked
        >
          {Object.values(ModelName).map(v =>
            <div
              className="
                flex
                items-center
                space-x-2
              "
              key={v}
            >
              <RadioGroup.Item
                className="
                  bg-white
                  w-[16px]
                  h-[16px]
                  rounded-full
                  hover:bg-slate-100
                  shadow-slate-200
                  focus:border-slate-300
                  shadow-[0_0_0_2px]
                  focus:shadow-slate-500
                  outline-none
                  cursor-default
                "
                value={v}
              >
                <RadioGroup.Indicator className="
                  flex
                  items-center
                  justify-center
                  w-full
                  h-full
                  relative
                  after:content-['']
                  after:block
                  after:w-[5px]
                  after:h-[5px]
                  after:rounded-[50%]
                  " />
              </RadioGroup.Item>
              <Text
                text={v}
                className=""
              />
            </div>
          )}
        </RadioGroup.Root>
      </div>
    </div>
  )
}

export default Context
