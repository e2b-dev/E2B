'use client'

import { redirect, usePathname } from 'next/navigation'

export default function NotFound() {
  const pathname = usePathname()
  if (pathname.startsWith('/docs')) {
    return redirect('/docs')
  }
  return redirect('/dashboard')
}
