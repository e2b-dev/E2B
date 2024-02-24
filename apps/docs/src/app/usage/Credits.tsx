'use client'

import React from 'react'
import {
  Ticket,
} from 'lucide-react'
import Link from 'next/link'

import SpinnerIcon from '@/components/Spinner'
import ManageBilling from '@/components/ManageBilling'
import { useUsage } from '@/utils/useUsage'
import { useUser } from '@/utils/useUser'

function formatCurrency(value: number) {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function Credits() {
  const { user } = useUser()
  const { credits, usage, isLoading } = useUsage()

  if (!user) {
    return (
      <div>
        <span>Sign in to see your usage</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col justify-start items-start gap-3">
      <ManageBilling />
      <div className="flex items-center justify-start gap-1">
        <Link href="/pricing">Change plan</Link>
      </div>

      <div className="flex flex-col justify-start items-start gap-1">
        <div className="flex items-center gap-1">
          <Ticket className="text-white" size={20} />
          <span className="font-medium text-white">Credits left</span>
        </div>
        <span className="text-sm">Will be used when generating invoice</span>
        {isLoading && <SpinnerIcon />}
        {!isLoading && (
          <span className="text-sm font-mono text-green-300/80">${formatCurrency(credits)}</span>
        )}
      </div>

      <div className="flex flex-col justify-start items-start gap-1">
        {usage.map((u, index) => (
          <React.Fragment key={index}>
            <h3 className="text-xl">
              {new Date(u.year, u.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              {u.year === 2024 && u.month === 2 ? ' (calculated from the 21st onwards)' : ''}
            </h3>

            <div className="flex flex-col justify-start items-start gap-4">
              <div className="flex flex-col items-start justify-start gap-1">
                <span className="font-bold">Total costs</span>
                <span className="text-sm font-mono">${formatCurrency(u.total_cost)}</span>
              </div>

              <div className="flex flex-col items-start justify-start gap-1">
                <span className="font-bold">{new Date().getMonth() + 1 === u.month ? 'To pay' : 'Paid'}</span>
                <span className="text-sm font-mono">${formatCurrency(u.unpaid_cost)}</span>
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>

    </div>
  )
}

export default Credits