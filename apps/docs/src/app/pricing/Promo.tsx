'use client'

import { useState } from 'react'
import { Button } from '@/components/Button'
import { useUser } from '@/utils/useUser'

function sendPromoCode(promoCode: string, teamID: string) {
  return fetch('/docs/pricing/promo', {
    method: 'POST',
    body: JSON.stringify({
      teamID,
      promoCode,
    }),
  })
}

function Promo() {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const { user } = useUser()

  async function applyPromoCode() {
    if (!code) return
    if (!user) {
      setError('You must be signed in to apply a promo code')
    }
    setError('')

    // TODO: Actually apply the promo code
    const response = await sendPromoCode(code, user.teams[0].id)
    const responseData = await response.json()

    console.log('repsonseData', responseData)
    if (responseData.error) {
      console.error('Error applying promo code:', responseData.error)
      setError(responseData.error)
    } else {
      console.log('Promo code applied successfully')
      location.reload()
    }
  }

  return (
    <div className="flex flex-col items-start justify-start gap-1">
      <div className="flex items-center justify-start gap-2">
        <div className="flex flex-col items-start justify-start">
          <input
            className="p-2 min-w-[300px] bg-transparent text-zinc-900 outline-none placeholder:text-zinc-500 dark:text-white sm:text-sm border border-gray-800 rounded-lg"
            placeholder="Enter promo code to unlock Pro tier"
            value={code}
            onChange={e => setCode(e.target.value)}
          />
        </div>
        <Button
          onClick={applyPromoCode}
        >
          Apply
        </Button>
      </div>
      {error && (
        <span className="text-red-500 font-medium">{error}</span>
      )}
    </div>
  )
}

export default Promo
