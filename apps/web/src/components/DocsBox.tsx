'use client'
import { ReactNode } from 'react'
import Link from 'next/link'
import { useMotionValue } from 'framer-motion'

export interface BoxItem {
  href: string
  title: string
  description: string
  icon: ReactNode
}

function Icon({ icon }: { icon: ReactNode }) {
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900/5 ring-1 ring-zinc-900/25 backdrop-blur-[2px] transition duration-300 group-hover:bg-white/50 group-hover:ring-zinc-900/25 dark:bg-white/7.5 dark:ring-white/15 dark:group-hover:bg-brand-300/10 dark:group-hover:ring-brand-400">
      {icon}
    </div>
  )
}

export function DocsBox({ item: { href, title, description, icon } }: { item: BoxItem }) {
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
      className="group relative flex rounded-2xl transition-shadow hover:shadow-md bg-white/2.5 hover:shadow-black/5"
    >
      <div
        className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10 group-hover:ring-white/20" />
      <div className="relative rounded-2xl px-4 pb-4 pt-16">
        <Icon icon={icon} />
        {/* <UseCaseIcon icon={icon} /> */}
        <h3 className="mt-4 text-sm font-semibold leading-7 text-white">
          <Link href={href}>
            <span className="absolute inset-0 rounded-2xl" />
            {title}
          </Link>
        </h3>
        <p className="mt-1 text-sm text-zinc-400">
          {description}
        </p>
      </div>
    </div>
  )
}

export function BoxGrid({ items }: { items: Array<BoxItem> }) {
  return (
    <div className="xl:max-w-none">
      <div
        className="not-prose grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-4">
        {items.map(item => (
          <DocsBox
            key={item.href}
            item={item}
          />
        ))}
      </div>
    </div>
  )
}
