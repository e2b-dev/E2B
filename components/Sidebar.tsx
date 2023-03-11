import clsx from 'clsx'
import { PropsWithChildren } from 'react'

export enum Side {
  Left,
  Right,
}

export interface Props {
  side: Side
  className?: string
}

function Sidebar({ children, side, className }: PropsWithChildren<Props>) {
  return (
    <div
      className={clsx(
        `
        flex
        ${side === Side.Left ? 'w-[200px]' : 'w-[400px]'}
        border-slate-200
        bg-white
        `,
        {
          'border-r': side === Side.Left,
          'border-l': side === Side.Right,
        },
        className,
      )}
    >
      {children}
    </div>
  )
}

Sidebar.side = Side

export default Sidebar
