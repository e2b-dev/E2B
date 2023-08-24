import clsx from 'clsx'

export function Prose({ as: Component = 'div', className, ...props }) {
  return (
    <Component
      // @ts-ignore
      className={clsx(className, 'prose dark:prose-invert')}
      {...props}
    />
  )
}
