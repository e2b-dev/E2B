import Link from 'next/link'
import clsx from 'clsx'

function ArrowIcon(props: React.ComponentPropsWithoutRef<'svg'>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m11.5 6.5 3 3.5m0 0-3 3.5m3-3.5h-9"
      />
    </svg>
  )
}

const variantStyles = {
  primary:
    'rounded-full bg-zinc-900 py-1 px-3 text-white hover:bg-zinc-700 dark:bg-brand-400/10 dark:text-brand-400 dark:ring-1 dark:ring-inset dark:ring-brand-400/20 dark:hover:bg-brand-400/10 dark:hover:text-brand-300 dark:hover:ring-brand-300',
  secondary:
    'rounded-full bg-zinc-100 py-1 px-3 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800/40 dark:text-zinc-400 dark:ring-1 dark:ring-inset dark:ring-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-300',
  ternary:
    'rounded-full bg-yellow-100 py-1 px-3 text-yellow-900 hover:bg-yellow-200 dark:bg-yellow-800/40 dark:text-yellow-400 dark:ring-1 dark:ring-inset dark:ring-yellow-800 dark:hover:bg-yellow-800 dark:hover:text-yellow-300',
  filled:
    'rounded-full bg-zinc-900 py-1 px-3 text-white hover:bg-zinc-700 dark:bg-brand-500 dark:text-white dark:hover:bg-brand-400',
  outline:
    'rounded-full py-1 px-3 text-zinc-700 ring-1 ring-inset ring-zinc-900/10 hover:bg-zinc-900/2.5 hover:text-zinc-900 dark:text-zinc-400 dark:ring-white/10 dark:hover:bg-white/5 dark:hover:text-white',
  text: 'text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-500 underline',
  textLink:
    'text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-500 underline decoration-2 decoration-brand-500/30',
  textSubtle:
    'text-sm text-zinc-500 hover:text-zinc-600 dark:text-zinc-400 dark:hover:text-zinc-500 underline', // same as text, but gray-ish
  textTernary:
    'text-yellow-500 hover:text-yellow-600 dark:text-yellow-400 dark:hover:text-yellow-500', // same as text, but gray-ish
  desctructive:
    'rounded-full py-1 px-3 text-red-700 ring-1 ring-inset ring-red-900/50 hover:bg-red-900/90 hover:ring-white/10 hover:text-red-900 dark:text-red-400 dark:ring-red/10 dark:hover:bg-red/50 dark:hover:text-red',
}

type ButtonProps = {
  variant?: keyof typeof variantStyles
  disabled?: boolean
  arrow?: 'left' | 'right'
} & (
  | React.ComponentPropsWithoutRef<typeof Link>
  | (React.ComponentPropsWithoutRef<'button'> & { href?: undefined })
)

export function Button({
  variant = 'primary',
  disabled = false,
  className,
  children,
  arrow,
  ...props
}: ButtonProps) {
  className = clsx(
    'inline-flex gap-0.5 justify-center overflow-hidden text-base font-medium transition',
    variantStyles[variant],
    disabled && 'opacity-50 pointer-events-none',
    className
  )

  const arrowIcon = (
    <ArrowIcon
      className={clsx(
        'mt-0.5 h-5 w-5',
        variant === 'text' && 'relative top-px',
        arrow === 'left' && '-ml-1 rotate-180',
        arrow === 'right' && '-mr-1'
      )}
    />
  )

  const inner = (
    <div className="flex items-center gap-2">
      {arrow === 'left' && arrowIcon}
      {children}
      {arrow === 'right' && arrowIcon}
    </div>
  )

  if (typeof props.href === 'undefined') {
    return (
      // @ts-ignore
      <button className={className} {...props}>
        {inner}
      </button>
    )
  }

  return (
    // @ts-ignore
    <Link className={className} {...props}>
      {inner}
    </Link>
  )
}
