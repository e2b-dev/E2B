'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
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
    <div className="flex items-center justify-start gap-1">
      <Link href={url} target="_blank" rel="noreferrer">
        Manage Billing
      </Link>
      <ArrowRight size={16} />
    </div>
  )
}

export default ManageBilling
