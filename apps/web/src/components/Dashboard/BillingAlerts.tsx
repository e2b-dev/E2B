'use client'

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '../ui/use-toast'
import { Button } from '../Button'
import { getBillingUrl } from '@/app/(dashboard)/dashboard/utils'
import { Team, useUser } from '@/utils/useUser'

interface BillingThreshold {
  amount_gte: number | null
  alert_amount_percentage: number | null
}

export const BillingAlerts = ({
  team,
  domain,
  email,
}: {
  team: Team
  domain: string
  email: string
}) => {
  const { toast } = useToast()
  const [threshold, setThreshold] = useState<BillingThreshold>({
    amount_gte: null,
    alert_amount_percentage: null,
  })
  const { user } = useUser()

  const fetchBillingThreshold = useCallback(async () => {
    if (!user) return

    try {
      const res = await fetch(
        getBillingUrl(domain, `/teams/${team.id}/billing-thresholds`),
        {
          headers: {
            'X-Team-API-Key': team.apiKeys[0],
          },
        }
      )

      if (!res.ok) {
        toast({
          title: 'Failed to fetch billing alerts',
          description: 'Unable to load your billing alert settings',
        })
        return
      }

      const data = await res.json()
      setThreshold(data)
    } catch (error) {
      console.error('Error fetching billing threshold:', error)
      toast({
        title: 'Error',
        description: 'Failed to load billing alert settings',
      })
    }
  }, [user, domain, team, toast])

  const updateBillingThreshold = useCallback(async () => {
    if (!user) return

    try {
      const res = await fetch(
        getBillingUrl(domain, `/teams/${team.id}/billing-thresholds`),
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-Team-API-Key': team.apiKeys[0],
          },
          body: JSON.stringify(threshold),
        }
      )

      if (!res.ok) {
        toast({
          title: 'Failed to update billing alerts',
          description: 'Unable to save your billing alert settings',
        })
        return
      }

      toast({
        title: 'Billing alerts updated',
        description: 'Your billing alert settings have been saved',
      })
    } catch (error) {
      console.error('Error updating billing threshold:', error)
      toast({
        title: 'Error',
        description: 'Failed to save billing alert settings',
      })
    }
  }, [user, domain, team, threshold, toast])

  useEffect(() => {
    fetchBillingThreshold()
  }, [fetchBillingThreshold])

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="space-y-2 flex-1">
          <h3 className="font-medium">Set a Budget Alert</h3>
          <p className="text-sm text-white/70">
            When your usage reaches this percentage of your budget, you&apos;ll
            receive an early warning notification to <b>{email}</b>.
          </p>

          <div className="relative !mt-4">
            <input
              type="number"
              min="1"
              max="100"
              className="w-full border border-white/10 text-sm focus:outline-none outline-none rounded-md p-2 pr-12"
              value={threshold.alert_amount_percentage || ''}
              onChange={(e) =>
                setThreshold({
                  ...threshold,
                  alert_amount_percentage: Number(e.target.value) || null,
                })
              }
              placeholder="Enter percentage"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-white/50">
              %
            </div>
          </div>
        </div>

        <div className="space-y-2 flex-1">
          <h3 className="font-medium">Enable Budget Limit</h3>
          <p className="text-sm text-white/70">
            If your organization exceeds this threshold in a given billing
            period,
          </p>
          <p className="text-sm text-red-400">
            Caution: This helps you monitor spending before reaching your budget
            limit.
          </p>
          <div className="relative !mt-4">
            <input
              type="number"
              className="w-full border border-white/10 text-sm focus:outline-none outline-none rounded-md p-2 pr-12"
              value={threshold.amount_gte || ''}
              onChange={(e) =>
                setThreshold({
                  ...threshold,
                  amount_gte: Number(e.target.value) || null,
                })
              }
              placeholder="Enter amount"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-white/50">
              USD
            </div>
          </div>
        </div>
      </div>
      <Button
        onClick={updateBillingThreshold}
        className="mt-6 mb-4 float-right"
      >
        Save Budget Controls
      </Button>
    </>
  )
}
