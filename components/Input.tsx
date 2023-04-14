import clsx from 'clsx'
import {
  HTMLInputTypeAttribute,
  useEffect,
  useRef,
} from 'react'

import Text from 'components/Text'

export interface Props {
  value?: string
  placeholder?: string
  onChange: (value: string) => void
  isTransparent?: boolean
  autofocus?: boolean
  label?: string
  pattern?: string
  title?: string
  required?: boolean
  isDisabled?: boolean
  type?: HTMLInputTypeAttribute
  min?: number
  max?: number
  step?: number
}

function Input({
  value,
  isDisabled,
  required,
  pattern,
  title,
  isTransparent,
  autofocus,
  onChange,
  placeholder,
  label,
  min,
  max,
  step,
  type = 'text',
}: Props) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(
    function focus() {
      if (!ref.current) return
      if (autofocus) {
        ref.current.focus()
      }
    }, [autofocus])

  return (
    <div className="
      flex
      flex-col
      space-y-1
      flex-1
      ">
      {label &&
        <Text text={label} size={Text.size.S3} />
      }
      <input
        min={min?.toString()}
        max={max?.toString()}
        step={step?.toString()}
        required={required}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck="false"
        title={title}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        ref={ref}
        disabled={isDisabled}
        pattern={pattern}
        type={type}
        className={clsx(
          { 'bg-transparent': isTransparent },
          'w-full',
          'px-2',
          'focus:bg-white',
          'py-1',
          'rounded',
          'border',
          'border-slate-200',
          'hover:border-slate-300',
          'outline-none',
          'focus:border-green-800',
          'text-sm',
          'placeholder:text-slate-300',
        )}
      />
    </div>
  )
}

export default Input
