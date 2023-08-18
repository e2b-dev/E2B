import clsx from 'clsx'
import { UrlObject } from 'url'

import TitleLink from 'components/TitleLink'
import { ReactNode } from 'react'

export interface Props {
  active: boolean
  title: string
  href: UrlObject | string
  shallow?: boolean
  icon?: ReactNode
}

function HeaderLink({
  active,
  title,
  href,
  shallow,
  icon,
}: Props) {
  return (
    <div className="relative flex flex-col">
      <TitleLink
        icon={icon}
        active={active}
        className="px-1 py-3"
        href={href}
        size={TitleLink.size.S2}
        title={title}
        wrapperClassName="w-full justify-center flex"
        shallow={shallow}
      />
      <div
        className={clsx('absolute bottom-0 -mb-px w-full border-b', {
          'border-transparent': !active,
          'border-green-800': active,
        })}
      ></div>
    </div>
  )
}

export default HeaderLink
