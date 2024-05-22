import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@/utils/useUser'
import { Button } from '../Button'
import { useUsage } from '@/utils/useUsage'

function formatCurrency(value: number) {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export const BillingContent = () => {
  const { credits } = useUsage()

  return (
    <div className="flex flex-col w-full h-full">
      <div className='flex items-center space-x-4'>
        <h2 className='font-bold text-xl'>Make changes to your billing</h2>
        <ManageBilling />
      </div>

      {credits && (
      <div className='flex flex-col space-y-2 pb-10'>
        <h2 className='font-bold text-xl'>Credits left</h2>
        <span className="text-sm">Credits automatically are used to bill your team</span>
        <span className="text-sm font-mono text-green-300/80">${formatCurrency(credits)}</span>
      </div>
      )}

      <div>
        <h2 className='font-bold pb-10 text-xl'>Billing history</h2>
      </div>
      
    </div>
  )
}

const ManageBilling = () => {
  const { user } = useUser()
  const [url, setURL] = useState('')

  useEffect(function getBillingURL() {
    if (!user) return
    const u = `${process.env.NEXT_PUBLIC_STRIPE_BILLING_URL}?prefilled_email=${user.teams[0].email}`
    setURL(u)
  }, [user])

  if (!user || !url) {
    return null
  }

  return (
    <Button variant='secondary' className='w-fit'>
      <Link href={url} target="_blank" rel="noreferrer">
        To billing portal
      </Link>
    </Button>
  )
}


