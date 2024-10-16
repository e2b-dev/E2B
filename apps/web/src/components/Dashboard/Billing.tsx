import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Team, useUser } from '@/utils/useUser'
import { Button } from '../Button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import SwitchToHobbyButton from '@/components/Pricing/SwitchToHobbyButton'
import SwitchToProButton from '@/components/Pricing/SwitchToProButton'

function formatCurrency(value: number) {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface Invoice {
  cost: number
  paid: boolean
  url: string
  date_created: string
}

export const BillingContent = ({ team }: { team: Team }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [credits, setCredits] = useState<number | null>(null)

  useEffect(() => {
    const getInvoices = async function getInvoices() {
      setInvoices([])
      const res = await fetch(`${process.env.NEXT_PUBLIC_BILLING_API_URL}/teams/${team.id}/invoices`, {
        headers: {
          'X-Team-API-Key': team.apiKeys[0],
        },
      })
      if (!res.ok) {
        // TODO: add sentry error
        console.log(res)
        return
      }

      const invoices = await res.json() as Invoice[]
      setInvoices(invoices)

      setCredits(null)
      const creditsRes = await fetch(`${process.env.NEXT_PUBLIC_BILLING_API_URL}/teams/${team.id}/usage`, {
        headers: {
          'X-Team-API-Key': team.apiKeys[0],
        },
      })
      const credits = await creditsRes.json()
      setCredits(credits.credits)
    }

    getInvoices()
  }, [team])

  return (
    <div className="flex flex-col w-full h-full pb-10">
      <div className='flex items-center space-x-4 pb-10'>
        <h2 className='font-bold text-xl'>Make changes to your billing</h2>
        <ManageBilling />
      </div>

      <div className='flex flex-col space-y-2 pb-10'>
        <h2 className='font-bold text-xl'>Credits left</h2>
        <span className="text-sm">Credits are used to bill your team automatically</span>
        {credits === null ? (
          <span className="text-sm font-mono text-neutral-400">Loading...</span>
        ) : (
          <span className="text-sm font-mono text-green-300/80">${formatCurrency(credits ?? 0)}</span>
        )}
      </div>

      <div className='flex items-center space-x-4 pb-4'>
        <h2 className='font-bold text-xl'>Change tier</h2>
      </div>

      <div className='flex flex-col items-start justify-center pb-10'>
        <div className='flex items-center space-x-4'>
          <h2>Hobby tier</h2>
          <SwitchToHobbyButton team={team} />
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
          <SwitchToProButton team={team} />
        </div>
        <ul className='flex flex-col list-disc list-inside text-neutral-400'>
          <li>One-time $100 credits</li>
          <li>Dedicated Slack channel with live Pro support from our team</li>
          <li>Prioritized features</li>
          <li>Customize your <Link className="text-[#ff8800] underline" href="/docs/sandbox/compute">sandbox compute</Link></li>
          <li>Up to 24 hours sandbox session length</li>
          <li>Up to 100 concurrently running sandboxes</li>
        </ul>
      </div>

      <div>
        <h2 className='font-bold pb-4 text-xl'>Billing history</h2>
      </div>

      <Table>
        <TableHeader>
          <TableRow className='hover:bg-inherit dark:hover:bg-inherit border-b border-white/5 '>
            <TableHead>Date</TableHead>
            <TableHead>Cost</TableHead>
            <TableHead>Paid</TableHead>
            <TableHead>Invoice url</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices && invoices.length > 0 ? (
            invoices.map((item, index) => (
              <TableRow
                className='hover:bg-orange-300/10 dark:hover:bg-orange-300/10 border-b border-white/5'
                key={index}
              >
                <TableCell>{new Date(item.date_created).toLocaleDateString()}</TableCell>
                <TableCell>${item.cost.toFixed(2)}</TableCell>
                <TableCell>{item.paid ? 'Paid' : 'Unpaid'}</TableCell>
                <TableCell><a className='hover:cursor-pointer' href={item.url} target="_blank" rel="noreferrer noopener">View invoice</a></TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow className='border-b border-white/5'>
              <TableCell colSpan={4} className='text-center'>
                No invoices found
              </TableCell>
            </TableRow>
          )}
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


