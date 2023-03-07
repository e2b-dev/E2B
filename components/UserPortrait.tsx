import clsx from 'clsx'
import randomColor from 'randomcolor'
import { MouseEvent, useMemo } from 'react'

export interface Props {
  username?: string
  onClick?: (e: MouseEvent<HTMLDivElement, globalThis.MouseEvent>) => any
}

function UserPortrait({ onClick, username = '?' }: Props) {
  const backgroundColor = useMemo(
    () => randomColor({ luminosity: 'bright', seed: username }),
    [username],
  )

  return (
    <div
      style={{ borderColor: backgroundColor, backgroundColor }}
      className={clsx(
        'flex items-center justify-center relative rounded-full border',
        'h-6 w-6 text-sm',
        { 'cursor-pointer': !!onClick },
      )}
      onClick={onClick}
    >

      <div className="relative select-none text-white">
        {username[0].toUpperCase()}
      </div>
    </div>
  )
}

export default UserPortrait
