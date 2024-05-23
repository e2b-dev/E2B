import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@/utils/useUser'
import { Button } from '../Button'
import { useUsage } from '@/utils/useUsage'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import SwitchToHobbyButton from '@/app/(docs)/docs/pricing/SwitchToHobbyButton'
import SwitchToProButton from '@/app/(docs)/docs/pricing/SwitchToProButton'

function formatCurrency(value: number) {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export const BillingContent = () => {
  const { credits, usage, isLoading  } = useUsage()
  
  return (
    <div className="flex flex-col w-full h-full pb-10">
      <div className='flex items-center space-x-4 pb-10'>
        <h2 className='font-bold text-xl'>Make changes to your billing</h2>
        <ManageBilling />
      </div>

      <div className='flex flex-col space-y-2 pb-10'>
        <h2 className='font-bold text-xl'>Credits left</h2>
        <span className="text-sm">Credits automatically are used to bill your team</span>
        {credits && (
          <span className="text-sm font-mono text-green-300/80">${formatCurrency(credits)}</span>
        )}
        {isLoading && <span className="text-sm font-mono text-neutral-400">Loading...</span>}
      </div>

      <div className='flex items-center space-x-4 pb-4'>
        <h2 className='font-bold text-xl'>Change tier</h2>
      </div>
      
      <div className='flex flex-col items-start justify-center pb-10'>
        <div className='flex items-center space-x-4'>
          <h2>Hobby tier</h2>
          <SwitchToHobbyButton/>
        </div>
        <ul className='flex flex-col list-disc list-inside text-neutral-400'>
          <li>One-time $100 credits</li>
          <li>Community support</li>
          <li>Up to 1 hour sandbox session length</li>
          <li>Up to 20 concurrently running sandboxes</li>
        </ul>
      </div>

      <div className='flex flex-col items-start justify-center pb-10'>
        <div className='flex items-center space-x-4'>
          <h2>Pro tier</h2>
          <SwitchToProButton/>
        </div>
        <ul className='flex flex-col list-disc list-inside text-neutral-400'>
          <li>One-time $100 credits</li>
          <li>Community support</li>
          <li>Up to 1 hour sandbox session length</li>
          <li>Up to 20 concurrently running sandboxes</li>
        </ul>
      </div>

      <div>
        <h2 className='font-bold pb-4 text-xl'>Billing history</h2>
      </div>

      <Table>
      <TableHeader>
      <TableRow className='hover:bg-orange-500/10 dark:hover:bg-orange-500/10 border-b border-white/5 '>
        <TableHead>Date</TableHead>
        <TableHead>Cost</TableHead>
        <TableHead>Billed</TableHead>
      </TableRow>
      </TableHeader>
      <TableBody>
      {usage.map((usageItem, index) => (
        <TableRow 
        className='hover:bg-orange-300/10 dark:hover:bg-orange-300/10 border-b border-white/5'
        key={index}>
          <TableCell>{usageItem.month}/{usageItem.year}</TableCell>
          <TableCell>{usageItem.total_cost}</TableCell>
          <TableCell>{usageItem.unpaid_cost}</TableCell>
        </TableRow>
        ))}
      </TableBody>
      </Table>
      
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


