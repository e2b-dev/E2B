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
  const statFormatted = stat
  let statText = ''
  if (statType === 'discordUsers') statText = 'online'
  else if (statType === 'githubStars') statText = 'stars'
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
        <span
          className="
            grid
            whitespace-nowrap text-xs
            font-medium
            dark:text-white 
          "
          /* TODO: Add animation, but it's not so easy as it sounds */
          style={{
            gridTemplateColumns: stat ? '1fr' : '0fr',
            marginRight: stat ? '0.4rem' : '0',
          }}
        >
          <div className="overflow-hidden">
            <strong>{statFormatted}</strong> {statText}
          </div>
        </span>

        {icon}
      </Link>
    </li>
  )
}
