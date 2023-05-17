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
  onBlur?: () => void
  label?: string
  pattern?: string
  title?: string
  required?: boolean
  isDisabled?: boolean
  type?: HTMLInputTypeAttribute
  min?: number
  max?: number
  step?: number
  onClick?: () => void
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
  onBlur,
  placeholder,
  label,
  min,
  max,
  step,
  onClick,
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
      "
    >
      {label &&
        <Text text={label} size={Text.size.S3} />
      }
      <div
        onClick={() => {
          if (!ref.current) return
          onClick?.()
          ref.current.disabled = false
          ref.current.focus()
        }}
      >
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
          onBlur={onBlur}
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
    </div>
  )
}

export default Input
