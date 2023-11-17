'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useUser } from '@/utils/useUser'

export function Banner() {
  const [promoEnd, setPromoEnd] = useState(100)
  const { user } = useUser()

  // TODO: add corrent promo end date
  console.log('user', user)

  return (
    <div className="py-2 px-8 border-y border-zinc-700 flex flex-col md:flex-row gap-1 fixed inset-x-0 top-[55px] bg-zinc-800 z-40">
      <span className="text-sm">You&apos;re on a <b>trial</b> Pro tier. <b>Your trial will end on [TODO: Fix end date] {promoEnd}.</b></span>
      <span className="text-sm">Please <Link href="/getting-help" className="text-brand-400 underline font-medium">reach out</Link> for an ugprade.</span>
    </div>
  )
}
