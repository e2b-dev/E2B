import { ResponsiveBar } from '@nivo/bar'
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
      <BarChart className="aspect-[6/3] w-2/3 pb-10"/>
      
      <div className='flex items-center space-x-4'>
        <h2 className='font-bold text-xl'>Make changes to your billing</h2>
        <ManageBilling />
      </div>
    </div>
  )
}

function BarChart(props: any) {
  return (
    <div {...props}>
      <ResponsiveBar
        data={[
          { name: 'Jan', amount: 111 },
          { name: 'Feb', amount: 157 },
          { name: 'Mar', amount: 129 },
          { name: 'Apr', amount: 150 },
          { name: 'May', amount: 119 },
          { name: 'Jun', amount: 72 },
        ]}
        keys={['amount']}
        indexBy="name"
        margin={{ top: 0, right: 0, bottom: 40, left: 40 }}
        padding={0.2}
        colors={['#FFAF78']}
        axisBottom={{
          tickSize: 0,
          tickPadding: 16,
        }}
        axisLeft={{
          tickSize: 0,
          tickValues: 4,
          tickPadding: 16,
        }}
        gridYValues={4}
        theme={{
          tooltip: {
            chip: {
              borderRadius: '9999px',
            },
            container: {
              fontSize: '12px',
              borderRadius: '6px',
              color: 'black',
            },
          },
          grid: {
            line: {
              stroke: '#f3f4f6',
            },
          },
        }}
        borderRadius={4} // Apply a border radius to the top corners of the bars
        tooltipLabel={({ id }) => `${id}`}
        enableLabel={false}
        role="application"
        ariaLabel="A bar chart showing data"
      />
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


