import clsx from 'clsx'
import TextareaAutosize from 'react-textarea-autosize'

import { Block } from 'state/store'

export interface Props {
  onChange: (value: string) => void
  block: Block
}

function RequestBodyEditor({
  onChange,
  block,
}: Props) {
  return (
    <div className="
      flex
      flex-col
      items-start
      max-w-[65ch]
      flex-1
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
        onChange={e => onChange(e.target.value)}
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
    </div>
  )
}

export default RequestBodyEditor
