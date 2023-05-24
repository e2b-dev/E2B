import clsx from 'clsx'
import {
  MouseEvent,
} from 'react'
import {
  Github,
} from 'lucide-react'

import Text from 'components/Text'

export interface Props {
  className?: string
  onClick?: (e: MouseEvent<HTMLButtonElement, globalThis.MouseEvent>) => any
  isDisabled?: boolean
}

function GitHubButton({
  className,
  onClick,
  isDisabled,
}: Props) {
  return (
    <button
      className={clsx(
        'flex',
        'items-center',
        'justify-center',
        'transition-all',
        'rounded',
        'border',
        'space-x-2',
        'py-1',
        'px-4',
        'bg-black/80',
        'hover:bg-black',
        'text-white',
        'm-auto',
        className,
      )}
      onClick={!isDisabled ? onClick : undefined}
    >
      <Github size={16} />
      <Text
        size={Text.size.S2}
        className="font-medium"
        text="Continue with GitHub"
      />
    </button>
  )
}

export default GitHubButton