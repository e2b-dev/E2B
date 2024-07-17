import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { Auth } from '@/components/Auth'
import { HeaderSeparator } from '@/components/HeaderUtils'

export function HeaderDashboard() {
  return (
    <div
      className="h-14 border border-zinc-900/5 dark:border-white/5 flex items-center justify-between gap-12 px-4 transition sm:px-6 lg:px-8"
    >
      <div className="items-start justify-start lg:flex">
        <Link href="/" aria-label="Home">
          <Logo className="h-6" />
        </Link>
      </div>

      <div className="flex justify-center items-center space-x-5">
        <div className="flex items-center justify-center text-sm space-x-3 text-neutral-400">
          <Link className='hover:text-white hover:cursor-pointer' href='/docs'>
            Docs
          </Link>
          <Link className='hover:text-white hover:cursor-pointer' href='/dashboard'>
            Dashboard
          </Link>
        </div>

        <div className="flex items-center gap-5">
          <HeaderSeparator />
          <Auth />
        </div>
      </div>

    </div>
  )
}
