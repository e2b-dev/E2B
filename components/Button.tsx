import clsx from 'clsx'
import {
  MouseEvent,
  ReactNode,
} from 'react'

import Text from 'components/Text'

export enum Variant {
  Full,
  Outline,
  Uncolored,
}

export enum IconPosition {
  Left,
  Right,
}

export interface Props {
  className?: string
  text?: string
  variant?: Variant
  icon?: ReactNode
  onClick?: (e: MouseEvent<HTMLButtonElement, globalThis.MouseEvent>) => any
  isDisabled?: boolean
  type?: 'submit'
  iconPosition?: IconPosition
}

function Button({
  className,
  text,
  variant = Variant.Outline,
  icon,
  onClick,
  type,
  isDisabled,
  iconPosition = IconPosition.Left,
}: Props) {
  return (
    <button
      type={type}
      className={clsx(
        'flex',
        'items-center',
        'justify-center',
        'transition-all',
        'rounded-lg',
        'border',
        'space-x-1.5',
        'py-1.5',
        'px-3',
        {
          'cursor-not-allowed opacity-70': isDisabled,
          'bg-green-800/90 text-white border-transparent hover:bg-green-800 font-semibold':
            variant === Variant.Full,
          'border-slate-200 hover:border-green-800 hover:text-green-800':
            variant === Variant.Outline,
        },
        className,
      )}
      onClick={!isDisabled ? onClick : undefined}
    >
      {iconPosition === IconPosition.Left && icon}
      {text && (
        <Text
          size={Text.size.S2}
          text={text}
        />
      )}
      {iconPosition === IconPosition.Right && icon}
    </button>
  )
}

Button.variant = Variant
Button.iconPosition = IconPosition

export default Button
