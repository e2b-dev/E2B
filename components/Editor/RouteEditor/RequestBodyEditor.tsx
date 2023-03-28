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
    ">
      <div className="
        self-stretch
        rounded-t-lg
        font-mono
        select-none
        text-slate-300
        text-xs
      ">
        {'{'}
      </div>
      <TextareaAutosize
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        spellCheck="false"
        name="block"
        placeholder="fieldName: Type"
        value={block.prompt}
        onChange={e => onChange(e.target.value)}
        className={clsx(
          'w-full',
          'pl-8',
          'pr-4',
          'py-1',
          'leading-6',
          'tracking-wide',
          'font-mono',
          'text-slate-500',
          'focus:text-slate-600',
          'no-scroller',
          'outline-none',
          'text-sm',
          'placeholder:text-slate-300',
        )}
      />
      <div className="
        self-stretch
        rounded-b-lg
        font-mono
        select-none
        text-slate-300
        text-xs
      ">
        {'}'}
      </div>
    </div>
  )
}

export default RequestBodyEditor
