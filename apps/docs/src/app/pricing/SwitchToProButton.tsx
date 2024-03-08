'use client'

import Link from 'next/link'
import { Button } from '@/components/Button'
import { useUser } from '@/utils/useUser'
import { useState } from 'react'
import { tiers } from '@/utils/consts'
import Spinner from '@/components/Spinner'

import { TierActiveTag } from './TierActiveTag'

const billingApiURL = process.env.NEXT_PUBLIC_BILLING_API_URL
function createCheckout(tierID: string, teamID: string) {
  return fetch(`${billingApiURL}/checkouts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      teamID,
      tierID,
    }),
  })
}

function SwitchTierButton() {
  const { user, isLoading } = useUser()
  const [error, setError] = useState('')

  async function createCheckoutSession() {
    setError('')

    const response = await createCheckout(tiers.pro.id, user.teams[0].id)
    const responseData = await response.json()

    if (responseData.error) {
      setError(responseData.error)
    } else {
      window.open(responseData.url, '_blank')
    }
  }

  if (isLoading) {
    return <Spinner />
  }


  if (!user && !isLoading) {
    return (
      <Link href="/sign-in?view=sign-up">
        <Button>Sign Up</Button>
      </Link>
    )
  }


  // Only show the button if the user is on the base_v1 tier.
  // Teams can have custom tiers. We only want the button to users on the free tier.
  if (!billingApiURL || (user.pricingTier.id !== tiers.hobby.id && user.pricingTier.id !== tiers.pro.id)) {
    return
  }

  return (
    <div className="flex flex-col items-start justify-start gap-1 my-4">
      <div className="flex items-center justify-start gap-2">
        {user.pricingTier.id === tiers.pro.id && (
          <TierActiveTag />
        )}



        {user.pricingTier.id !== tiers.pro.id && (
          <Button
            onClick={createCheckoutSession}
          >
            Switch to Pro
          </Button>
        )}

        {(user.pricingTier.id === tiers.pro.id && !user.teams[0].team_billing[0].credit_card_added) && (
          <Button
            onClick={createCheckoutSession}
          >
            Add Credit Card
          </Button>
        )}
      </div>

      {error && (
        <span className="text-red-500 font-medium">{error}</span>
      )}
    </div>
  )
}

export default SwitchTierButton
