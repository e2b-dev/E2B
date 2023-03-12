import clsx from 'clsx'
import {
  useEffect,
  useRef,
} from 'react'
import TextareaAutosize from 'react-textarea-autosize'

import { Block } from 'state/store'
import DeleteButton from 'components/DeleteButton'

export interface Props {
  onChange: (block: Block) => void
  onDelete: () => void
  block: Block
  index: number,
  focus: { index: number }
  onFocus: () => void
}

function Basic({
  onChange,
  onDelete,
  block,
  index,
  focus,
  onFocus,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(function autofocus() {
    if (focus.index === index) {
      ref.current?.focus()
    }
  }, [focus, index])

  return (
    <div className="
      flex
      relative
      w-[65ch]
      items-center
    ">
      <TextareaAutosize
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        spellCheck="false"
        name="block"
        placeholder="Prompt"
        value={block.prompt}
        onChange={e => onChange({ ...block, prompt: e.target.value })}
        onFocus={onFocus}
        ref={ref}
        className={clsx(
          'w-full',
          'py-2',
          'px-4',
          'rounded-lg',
          'leading-6',
          'tracking-wide',
          'font-sans',
          'text-slate-500',
          'focus:text-slate-600',
          'no-scroller',
          'transition-[shadow,colors]',
          'focus:shadow',
          'border',
          'border-green-800/40',
          'bg-white',
          'outline-none',
          'focus:border-green-800',
          'text-sm',
          'placeholder:text-slate-300',
        )}
      />
      <div className="
        absolute
        translate-x-full
        right-0
        pl-1
        ">
        <DeleteButton
          onDelete={onDelete}
        />
      </div>
    </div>
  )
}

export default Basic
