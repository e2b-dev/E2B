'use client'
import { useState } from 'react'
import { useUser } from '@/utils/useUser'
export function Banner() {
  const [promoEnd, setPromoEnd] = useState(100)
  const { user } = useUser()

  console.log('user', user)


  if (!user?.pricingTier.isPromo) return null;

  return (
    <div className="p-2">
      <span>You&apos;re on a trial Pro tier. Your trial will end on {promoEnd}.</span>
      <span>Please reach if you want to stay on the Pro tier</span>
    </div>
  )
}
