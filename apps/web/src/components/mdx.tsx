import Link from 'next/link'
import clsx from 'clsx'

import { Heading } from '@/components/Heading'
import { Prose } from '@/components/Prose'
import LegacyBanner from './LegacyBanner'

export const a = Link
export { Button } from '@/components/Button'
export {
  CodeGroupAutoload,
  CodeGroup,
  Code as code,
  Pre as pre,
} from '@/components/Code'
export { LanguageSpecificText } from '@/components/LanguageSpecificText'

export function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <article className="mx-auto flex h-full max-w-6xl flex-col pb-10 pt-20 md:pt-18">
      <Prose className="flex-auto">
        <LegacyBanner />
        {children}
      </Prose>
    </article>
  )
}

export const h2 = function H2(
  props: Omit<React.ComponentPropsWithoutRef<typeof Heading>, 'level'>
) {
  return <Heading level={2} {...props} />
}

export const h3 = function H3(
  props: Omit<React.ComponentPropsWithoutRef<typeof Heading>, 'level'>
) {
  return <Heading level={3} {...props} />
}

function InfoIcon(props: React.ComponentPropsWithoutRef<'svg'>) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" {...props}>
      <circle cx="8" cy="8" r="8" strokeWidth="0" />
      <path
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M6.75 7.75h1.5v3.5"
      />
      <circle cx="8" cy="4" r=".5" fill="none" />
    </svg>
  )
}

export function Note({
  title,
  children,
}: {
  title?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={clsx(
        `
        bg-brand-50/50
        my-6
        flex
        gap-2.5
        rounded-2xl
        border
        border-brand-500/20
        p-4
        leading-6
        text-brand-900
        dark:border-brand-500/30
        dark:bg-brand-500/5
        dark:text-brand-200
        dark:[--tw-prose-links-hover:theme(colors.brand.300)]
        dark:[--tw-prose-links:theme(colors.white)]
      `,
        title && 'flex-col items-start justify-start'
      )}
    >
      <div className="flex gap-2.5 justify-start items-start">
        <InfoIcon
          className="
          mt-1
          h-4
          w-4
          flex-none
          fill-brand-500
          stroke-white
          dark:fill-brand-200/20
          dark:stroke-brand-200
        "
        />
        {title && <span className="font-bold">{title}</span>}
      </div>

      <div className="[&>:first-child]:mt-0 [&>:last-child]:mb-0">
        {children}
      </div>
    </div>
  )
}

export function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 items-start gap-x-16 gap-y-10 xl:max-w-none xl:grid-cols-2">
      {children}
    </div>
  )
}

export function Col({
  children,
  sticky = false,
}: {
  children: React.ReactNode
  sticky?: boolean
}) {
  return (
    <div
      className={clsx(
        '[&>:first-child]:mt-0 [&>:last-child]:mb-0',
        sticky && 'xl:sticky xl:top-24'
      )}
    >
      {children}
    </div>
  )
}

export function Options({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-6">
      <ul
        role="list"
        className="m-0 max-w-[calc(theme(maxWidth.xl)-theme(spacing.4))] list-none divide-y divide-zinc-900/5 p-0 dark:divide-white/5"
      >
        {children}
      </ul>
    </div>
  )
}

export function Option({
  name,
  children,
  type,
}: {
  name: string
  children: React.ReactNode
  type?: string
}) {
  return (
    <li className="m-0 px-0 py-4 first:pt-0 last:pb-0">
      <dl className="m-0 flex flex-wrap items-center gap-x-3 gap-y-2">
        <dt className="sr-only">Name</dt>
        {type && (
          <>
            <dt className="sr-only">Flags</dt>
            <dd className="font-mono text-xs text-zinc-600 dark:text-white">
              {' '}
              {type}
            </dd>
          </>
        )}
        {name && (
          <dd>
            <code className="text-zinc-300 dark:text-zinc-400">{name}</code>
          </dd>
        )}
        <dt className="sr-only">Description</dt>
        <dd className="w-full flex-none [&>:first-child]:mt-0 [&>:last-child]:mb-0">
          {children}
        </dd>
      </dl>
    </li>
  )
}
