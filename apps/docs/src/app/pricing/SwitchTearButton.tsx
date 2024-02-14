'use client'

import { Button } from '@/components/Button'
import { useUser } from '@/utils/useUser'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface Props {
  tierID: string
}

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

function tierDisplayName(tierID: string) {
  if (tierID === 'pro_v1') {
    return 'Pro'
  }
  throw new Error(`Unknown tierID: ${tierID}`)
}


function SwitchTearButton({
  tierID,
}: Props) {
  const { user } = useUser()
  const [error, setError] = useState('')
  const router = useRouter()

  async function createCheckoutSession() {
    setError('')

    const response = await createCheckout(tierID, user.teams[0].id)
    const responseData = await response.json()

    if (responseData.error) {
      setError(responseData.error)
    } else {
      router.push(responseData.url)
    }
  }

  // Only show the button if the user is on the base_v1 tier.
  // Teams can have custom tiers. We only want the button to users on the free tier.
  if (!user || !billingApiURL || user.teams[0].tier !== 'base_v1') {
    return
  }

  return (
    <div className="flex flex-col items-start justify-start gap-1 my-4">
      <div className="flex items-center justify-start gap-2">
        <div className="flex flex-col items-start justify-start">
        </div>
        <Button
          onClick={createCheckoutSession}
        >
          Switch to {tierDisplayName(tierID)} tier
        </Button>
      </div>
      {error && (
        <span className="text-red-500 font-medium">{error}</span>
      )}
    </div>
  )
}

export default SwitchTearButton
