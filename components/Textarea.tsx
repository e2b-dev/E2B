import clsx from 'clsx'
import { ChangeEvent, useEffect, useRef } from 'react'

export interface Props {
  value: string
  className?: string
  placeholder?: string
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => any
  isOpen: boolean
}

function Textarea({ value = '', className, placeholder, onChange, isOpen }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(function handleFocus() {
    if (!ref) return
    if (isOpen) {
      ref.current?.focus()
    }
  }, [isOpen])

  return (
    <textarea
      ref={ref}
      placeholder={placeholder}
      value={value}
      className={clsx(
        'w-full',
        'px-2.5',
        'py-2',
        'rounded',
        'border',
        'min-h-[200px]',
        'focus:outline-none',
        'font-sans',
        'border-transparent',
        'bg-gray-950/40',
        'outline-none',
        'transition-colors',
        'text-sm',
        'text-white',
        'placeholder:text-gray-100',
        className,
      )}
      onChange={onChange}
    />
  )
}

export default Textarea
