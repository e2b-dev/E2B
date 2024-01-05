'use client'

import { Button } from '@/components/Button'
import { useUser } from '@/utils/useUser'
import { useRouter } from 'next/navigation'


const manageBillingURL = process.env.NEXT_PUBLIC_STRIPE_BILLING_URL

function ManageBilling() {
  const { user } = useUser()
  const router = useRouter()

  if (!user || !manageBillingURL) {
    return
  }

  return (
    <div className="flex flex-col items-start justify-start gap-4 -mb-8">
        <div className="flex flex-col items-start justify-start">
        </div>
        <Button onClick={() => router.push(manageBillingURL)}>
          Manage Billing
        </Button>
    </div>
  )
}

export default ManageBilling
