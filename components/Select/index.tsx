import {
  useCallback,
  useRef,
  useState,
} from 'react'
import { useOnClickOutside } from 'usehooks-ts'
import clsx from 'clsx'
import { ChevronDown as ChevronDownIcon } from 'lucide-react'

import Text from 'components/Text'

import SelectValue, { Value } from './SelectValue'

export interface Props {
  values: Value[]
  selectedValue: Value
  onChange: (v: Value) => void
  // Where to align the modal
  direction: 'left' | 'right'
}

function Select({
  values,
  selectedValue,
  onChange,
  direction,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [isOpened, setIsOpened] = useState(false)

  const handleClickOutside = useCallback(() => {
    setIsOpened(false)
  }, [])

  const handleValueSelect = useCallback((val: Value) => {
    onChange(val)
    setIsOpened(false)
  }, [onChange])

  useOnClickOutside(ref, handleClickOutside)

  return (
    <div className="
      flex
      items-center
    ">
      <div
        className="
          relative
          select-none
        "
        ref={ref}
      >
        <div
          className={clsx(
            `transition-all
            cursor-pointer
            flex
            hover:border-green-600
            hover:text-green-600
            border-b-4
            items-center
            justify-between
            space-x-1`,
            {
              'text-green-600 border-green-600': isOpened,
              'text-green-500 border-green-500': !isOpened,
            }
          )}
          onClick={() => setIsOpened(val => !val)}
        >
          <Text
            className="font-mono"
            text={selectedValue.title}
          />
          <ChevronDownIcon
            className="self-center"
            size={14}
          />
        </div>

        {/* Modal */}
        {isOpened && (
          <div className={clsx(
            {
              'left-0': direction === 'left',
              'right-0': direction === 'right',
            },
            `z-[999]
            top-[28px]

            absolute
            p-1
            mt-0.5
            border border-green-500
            rounded
            bg-white
            space-y-2`
          )}>
            <div className="
              flex
              flex-col
              space-y-1
            ">
              {values.map(val => (
                <SelectValue
                  isSelected={val.key === selectedValue.key}
                  key={val.key}
                  value={val}
                  onSelect={handleValueSelect}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Select