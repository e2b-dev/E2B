'use client'

import { Button } from '@/components/Button'
import { useUser } from '@/utils/useUser'
import { useState } from 'react'
import { useRouter } from 'next/navigation'


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

function SwitchTearButton(props: {tierID: string }) {
  const { user } = useUser()
  const [error, setError] = useState('')
  const router = useRouter()

  async function createCheckoutSession() {
    setError('')

    const response = await createCheckout(props.tierID, user.teams[0].id)
    const responseData = await response.json()

    if (responseData.error) {
      setError(responseData.error)
    } else {
      router.push(responseData.url)
    }
  }

  if (!user || !billingApiURL || user.teams[0].tier === props.tierID){
    return
  }

  return (
    <div className="flex flex-col items-start justify-start gap-1">
      <div className="flex items-center justify-start gap-2">
        <div className="flex flex-col items-start justify-start">
        </div>
        <Button
          onClick={createCheckoutSession}
        >
          Switch to {props.tierID}
        </Button>
      </div>
      {error && (
        <span className="text-red-500 font-medium">{error}</span>
      )}
    </div>
  )
}

export default SwitchTearButton
