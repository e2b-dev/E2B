import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'

function ClipboardIcon(props) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" {...props}>
      <path
        strokeWidth="0"
        d="M5.5 13.5v-5a2 2 0 0 1 2-2l.447-.894A2 2 0 0 1 9.737 4.5h.527a2 2 0 0 1 1.789 1.106l.447.894a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2Z"
      />
      <path
        fill="none"
        strokeLinejoin="round"
        d="M12.5 6.5a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2m5 0-.447-.894a2 2 0 0 0-1.79-1.106h-.527a2 2 0 0 0-1.789 1.106L7.5 6.5m5 0-1 1h-3l-1-1"
      />
    </svg>
  )
}

export function CopyButton({
  code,
  customPositionClassNames = 'right-4 top-3.5', // default from TailwindUI, works great with code blocks
  onAfterCopy = () => {},
}) {
  const buttonRef = useRef()
  const [copyCount, setCopyCount] = useState(0)
  const copied = copyCount > 0

  useEffect(() => {
    if (copyCount > 0) {
      const timeout = setTimeout(() => {
        setCopyCount(0)
        // @ts-ignore
        buttonRef.current?.blur()
      }, 1000)
      return () => {
        clearTimeout(timeout)
      }
    }
  }, [copyCount])

  return (
    <button
      type="button"
      ref={buttonRef as any}
      tabIndex={-1} /* hide from tab order */
      className={clsx(
        customPositionClassNames,
        'group/button absolute overflow-hidden rounded-full border border-zinc-700 py-1 pl-2 pr-3 text-2xs font-medium opacity-0 transition focus:opacity-100 group-hover:opacity-100',
        copied
          ? 'bg-brand-400/20 ring-1 ring-inset ring-brand-400/20'
          : 'dark:hover:bg-red-500/ bg-white/5 hover:bg-white/7.5 dark:bg-white/2.5'
      )}
      onClick={() => {
        window.navigator.clipboard.writeText(code).then(() => {
          setCopyCount((count) => count + 1)
        })
        onAfterCopy()
      }}
    >
      <span
        aria-hidden={copied}
        className={clsx(
          'pointer-events-none flex items-center justify-center gap-0.5 text-zinc-400 transition duration-300',
          copied && '-translate-y-1.5 opacity-0'
        )}
      >
        <ClipboardIcon className="h-5 w-5 fill-zinc-500/20 stroke-zinc-500 transition-colors group-hover/button:stroke-zinc-400" />
        Copy
      </span>
      <span
        aria-hidden={!copied}
        className={clsx(
          'pointer-events-none absolute inset-0 flex items-center justify-center text-brand-400 transition duration-300',
          !copied && 'translate-y-1.5 opacity-0'
        )}
      >
        Copied!
      </span>
    </button>
  )
}
