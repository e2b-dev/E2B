import clsx from 'clsx'
import Link from 'next/link'
import { ReactNode } from 'react'
import { UrlObject } from 'url'

import Text, { Size } from 'components/Text'

export interface Props {
  className?: string
  wrapperClassName?: string
  href: UrlObject | string
  title: string
  icon?: ReactNode
  size?: Size
  active?: boolean
  shallow?: boolean
}

function TitleLink({
  className,
  wrapperClassName,
  href,
  title,
  icon,
  size,
  active,
  shallow,
}: Props) {
  return (
    <Link
      className={clsx('hover:no-underline', wrapperClassName)}
      href={href}
      shallow={shallow}
    >
      <Text
        icon={icon}
        size={size}
        text={title}
        className={clsx(
          'whitespace-nowrap',
          'transition-all',
          'space-x-2',
          active ? 'text-slate-600' : 'text-slate-400 hover:text-green-800',
          className,
        )}
      />
    </Link>
  )
}


TitleLink.size = Size

export default TitleLink