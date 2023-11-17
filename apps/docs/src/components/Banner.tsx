'use client'

import Link from 'next/link'
import { useUser } from '@/utils/useUser'
import useSWR from 'swr'

interface Promo {
  id: string
  validFrom: string
  validTo: string
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function Banner() {
  const { user } = useUser()

  const { data, error, isLoading } = useSWR<Promo>(`/docs/pricing/promo?${new URLSearchParams({ id: user?.pricingTier.id })}`, fetcher)

  if (isLoading) return null;

  if (error) {
    console.error('Error fetching promo:', error)
    return null;
  }

  if (!user?.pricingTier.isPromo) return null;

  return (
    <div className="py-2 px-8 border-y border-zinc-700 flex flex-col md:flex-row gap-1 fixed inset-x-0 top-[55px] bg-zinc-800 z-40">
      <span className="text-sm">You&apos;re on a <b>trial</b> Pro tier. <b>Your trial will end on {new Date(data.validTo).toLocaleDateString()}.</b></span>
      <span className="text-sm">Please <Link href="/getting-help" className="text-brand-400 underline font-medium">reach out</Link> for an ugprade.</span>
    </div>
  )
}
