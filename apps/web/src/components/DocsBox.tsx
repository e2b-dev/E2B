'use client'
import { ReactNode } from 'react'
import clsx from 'clsx'
import Link from 'next/link'
import { useMotionValue } from 'framer-motion'

export interface BoxItem {
  href: string
  title: string
  description: string
  icon: ReactNode
}

function Icon({
  icon,
  noBackground,
}: {
  icon: ReactNode
  noBackground?: boolean
}) {
  return (
    <div
      className={clsx(
        'flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-[2px] transition duration-300 ',
        noBackground
          ? 'bg-none ring-0'
          : 'ring-1 ring-white/15 bg-white/7.5 group-hover:bg-brand-300/10 group-hover:ring-brand-400'
      )}
    >
      {icon}
    </div>
  )
}

export function DocsBox({
  item: { href, title, description, icon },
  noBackground,
}: {
  item: BoxItem
  noBackground?: boolean
}) {
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  function onMouseMove({ currentTarget, clientX, clientY }) {
    const { left, top } = currentTarget.getBoundingClientRect()
    mouseX.set(clientX - left)
    mouseY.set(clientY - top)
  }

  return (
    <div
      key={href}
      onMouseMove={onMouseMove}
      className={clsx(
        'group relative flex rounded-2xl transition-shadow hover:shadow-md',
        noBackground
          ? 'bg-none hover:bg-none'
          : 'bg-white/2.5 hover:shadow-black/5'
      )}
    >
      <div
        className={clsx(
          'absolute inset-0 rounded-2xl',
          noBackground
            ? 'ring-0 outline-none'
            : 'ring-1 ring-inset ring-white/10 group-hover:ring-white/20'
        )}
      />
      {noBackground ? (
        <div className="relative flex items-start justify-start gap-4">
          <Icon icon={icon} noBackground={true} />
          <div className="flex flex-col gap-1 items-start justify-start">
            <h3 className="text-sm font-semibold leading-7 text-white">
              <Link href={href}>
                <span className="absolute inset-0 rounded-2xl" />
                {title}
              </Link>
            </h3>
            <p className="mt-1 text-sm text-zinc-400">{description}</p>
          </div>
        </div>
      ) : (
        <div className="relative rounded-2xl px-4 pb-4 pt-16">
          <Icon icon={icon} />
          <h3 className="mt-4 text-sm font-semibold leading-7 text-white">
            <Link href={href}>
              <span className="absolute inset-0 rounded-2xl" />
              {title}
            </Link>
          </h3>
          <p className="mt-1 text-sm text-zinc-400">{description}</p>
        </div>
      )}
    </div>
  )
}

export function BoxGrid({
  items,
  noBackground,
}: {
  items: Array<BoxItem>
  noBackground?: boolean
}) {
  return (
    <div className="xl:max-w-none">
      <div className="mt-4 not-prose grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <DocsBox key={item.href} item={item} noBackground={noBackground} />
        ))}
      </div>
    </div>
  )
}
