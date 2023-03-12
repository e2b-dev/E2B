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

function BlockEditor({
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
      flex-col
      items-start
      relative
      w-[65ch]
      border
      border-green-800/40
      rounded-lg
    ">
      <div className="
        self-stretch
        rounded-t-lg
        py-1
        px-4
        font-mono
        text-slate-400
        text-sm
        bg-gray-50
      ">
        {'{'}
      </div>
      <TextareaAutosize
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        spellCheck="false"
        name="block"
        placeholder="fieldName: Type,"
        value={block.prompt}
        onChange={e => onChange({ ...block, prompt: e.target.value })}
        onFocus={onFocus}
        ref={ref}
        className={clsx(
          'w-full',
          'pl-8',
          'pr-4',
          'py-2',
          'leading-6',
          'tracking-wide',
          'font-mono',
          'text-slate-500',
          'focus:text-slate-600',
          'no-scroller',
          'transition-[shadow,colors]',
          'focus:shadow',
          'bg-white',
          'outline-none',
          'text-sm',
          'placeholder:text-slate-300',
        )}
      />
      <div className="
        self-stretch
        rounded-b-lg
        py-1
        px-4
        font-mono
        text-slate-400
        text-sm
        bg-gray-50
      ">
        {'}'}
      </div>
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

export default BlockEditor
