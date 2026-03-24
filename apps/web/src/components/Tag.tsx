import clsx from 'clsx'
import React from 'react'

export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span
      className={clsx(
        'relative top-[1.5px] font-mono text-[0.625rem] font-semibold',
        'text-brand-400 bg-brand-1000 ring-1 ring-inset rounded-lg px-1.5 ring-brand-400/20'
      )}
    >
      {children}
    </span>
  )
}
