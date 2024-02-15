'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/Button'
import { useUser } from '@/utils/useUser'

function ManageBilling() {
  const { user } = useUser()
  const [url, setURL] = useState('')

  useEffect(function getBillingURL() {
    if (!user) return
    const u = `${process.env.NEXT_PUBLIC_STRIPE_BILLING_URL}?prefilled_email=${user.teams[0].email}`
    setURL(u)
  }, [user])

  if (!user || !url) {
    return
  }

  return (
    <div className="mb-8 flex flex-col items-start justify-start gap-4">
      <div className="flex flex-col items-start justify-start"></div>
      <a href={url} target="_blank" rel="noreferrer">
        <Button>Manage Billing</Button>
      </a>
    </div>
  )
}

export default ManageBilling
