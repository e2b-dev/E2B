'use client'

import { AlertCircle } from 'lucide-react'
import { usePathname } from 'next/navigation'

export default function LegacyBanner() {
  const pathname = usePathname()

  const isLegacy = pathname?.startsWith('/docs/legacy')

  if (!isLegacy) return null

  return (
    <>
      <div className="sticky top-[5rem] inset-x-0 z-10">
        <div className="flex items-center gap-2 max-w-6xl mx-auto w-fit px-4 py-3 rounded-2xl bg-brand-400/10 backdrop-blur-sm text-brand-400/80 ring-1 ring-inset ring-brand-400/20">
          <AlertCircle className="h-4 w-4 " />
          <span>
            You are reading a{' '}
            <span className="text-brand-400/90">legacy (pre v1.0)</span>{' '}
            document.
          </span>
        </div>
      </div>
      <div className="h-16" />
    </>
  )
}
