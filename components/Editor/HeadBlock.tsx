import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Block } from 'state/store'

export interface Props {
  onConfirm: (block: Block) => void
}

export default function HeadBlock({ onConfirm }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  const [prompt, setPrompt] = useState<string>('')

  useEffect(function autofocus() {
    ref.current?.focus()
  }, [])

  return (
    <div className="flex flex-col flex-1 min-w-[500px]">
      <form
        autoComplete="on"
        onSubmit={e => {
          e.preventDefault()
          if (!prompt) {
            toast('Prompt must not be empty')
            ref.current?.focus()
            return
          }
          onConfirm({
            prompt,
          })
          setPrompt('')
        }}
      >
        <input
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          name="block"
          placeholder="What to do..."
          type="text"
          ref={ref}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          className={clsx(
            'w-full',
            'px-4',
            'py-2',
            'hover:border-green-800/40',
            'rounded-full',
            'transition-all',
            'border',
            'border-slate-200',
            'bg-white',
            'outline-none',
            'focus:border-green-800',
            'text-sm',
            'placeholder:text-slate-300',
          )}
          required
        />
      </form>
    </div>
  )
}
