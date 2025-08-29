import clsx from 'clsx'
import { useEffect, useRef } from 'react'

// export interface Props {
//   value: string
//   className?: string
//   placeholder?: string
//   onChange: (e: ChangeEvent<HTMLTextAreaElement>) => any
//   isOpen: boolean
// }

function Textarea({ value = '', className, placeholder, onChange, isOpen }) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(
    function handleFocus() {
      if (!ref) return
      if (isOpen) {
        ref.current?.focus()
      }
    },
    [isOpen]
  )

  return (
    <textarea
      ref={ref}
      placeholder={placeholder}
      value={value}
      autoCapitalize="off"
      autoCorrect="on"
      autoComplete="off"
      className={clsx(
        'w-full',
        'py-3',
        'px-4',
        'rounded',
        'border',
        'min-h-[200px]',
        'focus:outline-none',
        'font-sans',
        'border-gray-700',
        'focus:border-gray-500',
        'bg-white/2.5',
        'outline-none',
        'ring-0',
        'transition-colors',
        'text-white',
        'placeholder:text-gray-500',
        className
      )}
      onChange={onChange}
    />
  )
}

export default Textarea
