'use client'

import React from 'react'
import {
  Ticket,
} from 'lucide-react'
import Link from 'next/link'

import ManageBilling from '@/components/ManageBilling'
import { useUsage } from '@/utils/useUsage'
import { useUser } from '@/utils/useUser'

function usedCredits(totalCosts: number, unpaidCosts: number) {
  return totalCosts - unpaidCosts
}

function formatCurrency(value: number) {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function Credits() {
  const { user } = useUser()

  // TODO: Show user their plan

  // TODO: Add "switch tier"/"manage billing" button
  const { credits, costs } = useUsage()

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
        <span className="text-sm font-mono text-green-300/80">${credits}</span>
      </div>

      <div className="flex flex-col justify-start items-start gap-1">
        {costs.map((cost, index) => (
          <React.Fragment key={index}>
            <h3 className="text-xl">
              {new Date(cost.year, cost.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h3>

            <div className="flex flex-col justify-start items-start gap-4">
              <div className="flex flex-col items-start justify-start gap-1">
                <span className="font-bold">Total costs</span>
                <span className="text-sm font-mono">${formatCurrency(cost.total_costs)}</span>
              </div>

              <div className="flex flex-col items-start justify-start gap-1">
                <span className="font-bold">{new Date().getMonth() + 1 === cost.month ? 'To pay' : 'Paid'}</span>
                <span className="text-sm font-mono">${formatCurrency(cost.unpaid_costs)}</span>
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>

    </div>
  )
}

export default Credits