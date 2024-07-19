import Link from 'next/link'

export default function TopLevelNavItem({
  href,
  stat,
  statType,
  icon,
}: {
  href: string
  stat?: number | null
  statType?: string
  icon: React.ReactNode
}) {
  const statFormatted = stat?.toLocaleString() || '6,300+'
  let statText = ''
  if (statType === 'discordUsers') statText = 'online'
  else if (statType === 'githubStars') statText = '⭐️'
  return (
    <li>
      <Link
        href={href}
        className="
          flex items-center
          text-zinc-600
          dark:text-zinc-400 dark:hover:text-white
        "
      >
        <div
          className="
            flex
            items-center
            gap-1
            whitespace-nowrap
            text-xs
            text-white
          "
        >
          {icon}
          <div className="overflow-hidden font-medium">
            GitHub ({statFormatted} {statText})
          </div>
        </div>
      </Link>
    </li>
  )
}
