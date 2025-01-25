'use client'

import Link from 'next/link'
import { Button } from '@/components/Button'
import { Team, useUser } from '@/utils/useUser'
import { useState } from 'react'
import { tiers } from '@/utils/consts'
import Spinner from '@/components/Spinner'

import { TierActiveTag } from './TierActiveTag'
import { getBillingUrl } from '@/app/(dashboard)/dashboard/utils'

function createCheckout(domain: string, tierID: string, teamID: string) {
  return fetch(getBillingUrl('e2b.dev', '/checkouts'), {
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

function SwitchTierButton({ team, domain }: { team: Team; domain: string }) {
  const { user, isLoading } = useUser()
  const [error, setError] = useState('')

  async function createCheckoutSession() {
    setError('')

    if (!user) {
      return setError('You must be logged in to switch to Pro.')
    }

    const response = await createCheckout(
      domain,
      tiers.pro.id,
      user.teams[0].id
    )
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

  if (!user) {
    return (
      <Link href="/auth/sign-up">
        <Button>Sign Up</Button>
      </Link>
    )
  }

  // Only show the button if the user is on the base_v1 tier.
  // Teams can have custom tiers. We only want the button to users on the free tier.
  if (!domain || (team.tier !== tiers.hobby.id && team.tier !== tiers.pro.id)) {
    return
  }

  return (
    <div className="flex flex-col items-start justify-start gap-1 my-4">
      <div className="flex items-center justify-start gap-2">
        {team.tier === tiers.pro.id && <TierActiveTag />}
        {team.tier !== tiers.pro.id && (
          <Button onClick={createCheckoutSession}>Switch to Pro</Button>
        )}
      </div>

      {error && <span className="text-red-500 font-medium">{error}</span>}
    </div>
  )
}

export default SwitchTierButton
