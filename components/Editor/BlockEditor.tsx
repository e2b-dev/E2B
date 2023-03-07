import clsx from 'clsx'
import { Wrench } from 'lucide-react'
import {
  useState,
  useEffect,
  MouseEvent,
  useRef,
} from 'react'
import TextareaAutosize from 'react-textarea-autosize'

import Text from 'src/components/Text'
import { Block } from 'src/state/store'

export interface Props {
  onChange: (block: Block) => void
  onDelete: () => void
  block: Block
  index: number,
  focus: { index: number }
  onFocus: () => void
}

export default function BlockEditor({
  onChange,
  onDelete,
  block,
  index,
  focus,
  onFocus,
}: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(
    function expireConfirm() {
      if (confirmDelete) {
        const cleanup = setTimeout(() => setConfirmDelete(false), 4000)
        return () => {
          clearTimeout(cleanup)
        }
      }
    },
    [confirmDelete],
  )

  useEffect(function autofocus() {
    if (focus.index === index) {
      ref.current?.focus()
    }
  }, [focus, index])

  function handleDelete(
    e: MouseEvent<HTMLButtonElement, globalThis.MouseEvent>,
  ) {
    e.stopPropagation()
    e.preventDefault()

    if (confirmDelete) {
      try {
        onDelete()
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`Error deleting item: ${msg}`)
      }
    } else {
      setConfirmDelete(true)
    }
  }

  return (
    <div className="
      flex
      relative
      w-[65ch]
    ">
      <div className="
        absolute
        -translate-x-full
        pr-2
        ">
        <button
          className={clsx(
            `flex
            items-center
            justify-center
            transition-all
            rounded-lg
            border
            border-transparent
            px-3
            py-1.5
            `,
            {
              'border-red-600 hover:bg-red-600/10': confirmDelete,
            },
          )}
          onClick={handleDelete}
        >
          <Text
            size={Text.size.S3}
            text={confirmDelete ? 'Confirm' : 'Delete'}
            className={clsx('whitespace-nowrap hover:text-red-600 transition-all', {
              'text-red-600': confirmDelete,
              'text-slate-300': !confirmDelete,
            })}
          />
        </button>
      </div>
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
        pl-2
      ">
        <button
          className={clsx(`
            flex
            items-center
            justify-center
            rounded-lg
            border
            border-transparent
            px-3
            py-1.5
            `,
          )}
        >
          <Text
            size={Text.size.S3}
            text="Tools"
            icon={<Wrench size="14px" />}
            className={clsx('whitespace-nowrap transition-all text-slate-400 hover:text-slate-500')}
          />
        </button>
      </div>
    </div>
  )
}
