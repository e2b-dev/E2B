import Link from 'next/link'
import {
  Mail,
  Github,
  UsersRound,
} from 'lucide-react'

export function Support() {
  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-2 items-center lg:items-start justify-center xl:max-w-none">
      <div className="w-full lg:flex-1 h-[150px] bg-white/2.5 rounded transition-colors hover:bg-white/5 border border-white/5 group transition hover:border-white/10">
        <Link
          href="https://discord.com/invite/U7KEcGErtQ"
          className="no-underline flex flex-col justify-center items-center gap-2 h-full w-full"
        >
          <UsersRound strokeWidth={1.5} className="h-6 w-6 text-zinc-300 group-hover:text-[#5865F2] transition-colors" />
          <span className="text-zinc-300 transition-colors group-hover:text-white">Join our Discord community</span>
        </Link>
      </div>

      <div className="w-full lg:flex-1 h-[150px] bg-white/2.5 rounded transition-colors hover:bg-white/5 border border-white/5 group transition hover:border-white/10">
        <Link
          href="https://github.com/e2b-dev/e2b"
          className="no-underline flex flex-col justify-center items-center gap-2 h-full w-full"
        >
          <Github strokeWidth={1.5} className="h-6 w-6 text-zinc-300 group-hover:text-[#6e40c9] transition-colors" />
          <span className="text-zinc-300 transition-colors group-hover:text-white">Visit our GitHub</span>
        </Link>
      </div>

      <div className="w-full lg:flex-1 h-[150px] bg-white/2.5 rounded transition-colors hover:bg-white/5 border border-white/5 group transition hover:border-white/10">
        <Link
          href="mailto:support@e2b.dev"
          className="no-underline	flex flex-col justify-center items-center gap-2 h-full w-full"
        >
          <Mail strokeWidth={1.5} className="h-6 w-6 text-zinc-300 group-hover:text-white transition-colors" />
          <span className="text-zinc-300 transition-colors group-hover:text-white">Contact us</span>
        </Link>
      </div>
    </div>
  )
}