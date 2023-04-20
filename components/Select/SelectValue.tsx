import { Check as CheckIcon } from 'lucide-react'
import clsx from 'clsx'

import Text from 'components/Text'

export interface Value {
  title: string
  key: string
}

export interface Props {
  value: Value
  onSelect: (v: Value) => void
  isSelected: boolean
}

function SelectValue({
  value,
  onSelect,
  isSelected,
}: Props) {
  return (
    <div
      className={clsx(
        `
        px-2
        cursor-pointer
        border-transparent
        hover:bg-green-200
        flex
        items-center
        rounded
        justify-start
        space-x-2
        py-1
        `,
        {
          'text-green-800': isSelected,
          'text-slate-500': !isSelected,
        },
      )}
      onClick={() => onSelect(value)}
    >
      <div className={clsx(
        `w-[14px]
        h-[16px]
        flex
        items-center
        justify-center
        `,
      )}>
        {isSelected &&
          <CheckIcon
            className="self-center"
            size={14}
          />
        }
      </div>
      <Text
        className="whitespace-nowrap font-mono"
        text={value.title}
      />
    </div>
  )
}

export default SelectValue
