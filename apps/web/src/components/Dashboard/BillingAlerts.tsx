'use client'

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '../ui/use-toast'
import { Button } from '../Button'
import { getBillingUrl } from '@/app/(dashboard)/dashboard/utils'
import { Team, useUser } from '@/utils/useUser'
import { Loader2 } from 'lucide-react'

interface BillingLimit {
  limit_amount_gte: number | null
  alert_amount_gte: number | null
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
  const [originalLimits, setOriginalLimits] = useState<BillingLimit>({
    limit_amount_gte: null,
    alert_amount_gte: null,
  })
  const [limits, setLimits] = useState<BillingLimit>({
    limit_amount_gte: null,
    alert_amount_gte: null,
  })
  const [editMode, setEditMode] = useState({
    limit: false,
    alert: false,
  })
  const { user } = useUser()
  const [isLoading, setIsLoading] = useState({
    limit: {
      save: false,
      clear: false,
    },
    alert: {
      save: false,
      clear: false,
    },
  })

  const fetchBillingLimits = useCallback(async () => {
    if (!user) return

    try {
      const res = await fetch(
        getBillingUrl(domain, `/teams/${team.id}/billing-limits`),
        {
          headers: {
            'X-User-Access-Token': user.accessToken,
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
      setOriginalLimits(data)
      setLimits(data)
    } catch (error) {
      console.error('Error fetching billing threshold:', error)
      toast({
        title: 'Error',
        description: 'Failed to load billing alert settings',
      })
    }
  }, [user, domain, team, toast])

  const updateBillingLimit = async (type: 'limit' | 'alert') => {
    if (!user) return

    setIsLoading((prev) => ({
      ...prev,
      [type]: { ...prev[type], save: true },
    }))

    const value =
      type === 'limit' ? limits.limit_amount_gte : limits.alert_amount_gte

    try {
      const res = await fetch(
        getBillingUrl(domain, `/teams/${team.id}/billing-limits`),
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Access-Token': user.accessToken,
          },
          body: JSON.stringify({
            [type === 'limit' ? 'limit_amount_gte' : 'alert_amount_gte']: value,
          }),
        }
      )

      if (!res.ok) {
        toast({
          title: 'Failed to update billing alert',
          description: 'Unable to save your billing alert setting',
        })
        return
      }

      setOriginalLimits((prev) => ({
        ...prev,
        [type === 'limit' ? 'limit_amount_gte' : 'alert_amount_gte']: value,
      }))

      toast({
        title: 'Billing alert updated',
        description: 'Your billing alert setting has been saved',
      })
    } catch (error) {
      console.error('Error updating billing threshold:', error)
      toast({
        title: 'Error',
        description: 'Failed to save billing alert settings',
      })
    } finally {
      setIsLoading((prev) => ({
        ...prev,
        [type]: { ...prev[type], save: false },
      }))
    }
  }

  const deleteBillingLimit = async (type: 'limit' | 'alert') => {
    if (!user) return

    setIsLoading((prev) => ({
      ...prev,
      [type]: { ...prev[type], clear: true },
    }))

    try {
      const res = await fetch(
        getBillingUrl(
          domain,
          `/teams/${team.id}/billing-limits/${type === 'limit' ? 'limit_amount_gte' : 'alert_amount_gte'
          }`
        ),
        {
          method: 'DELETE',
          headers: {
            'X-User-Access-Token': user.accessToken,
          },
        }
      )

      if (!res.ok) {
        toast({
          title: 'Failed to clear billing alert',
          description: 'Unable to clear your billing alert setting',
        })
        return
      }

      setOriginalLimits((prev) => ({
        ...prev,
        [type === 'limit' ? 'limit_amount_gte' : 'alert_amount_gte']: null,
      }))
      setLimits((prev) => ({
        ...prev,
        [type === 'limit' ? 'limit_amount_gte' : 'alert_amount_gte']: null,
      }))

      toast({
        title: 'Billing alert cleared',
        description: 'Your billing alert setting has been cleared',
      })
    } catch (error) {
      console.error('Error clearing billing threshold:', error)
      toast({
        title: 'Error',
        description: 'Failed to clear billing alert settings',
      })
    } finally {
      setIsLoading((prev) => ({
        ...prev,
        [type]: { ...prev[type], clear: false },
      }))
    }
  }

  useEffect(() => {
    fetchBillingLimits()
  }, [fetchBillingLimits])

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>,
    type: 'limit' | 'alert'
  ) => {
    e.preventDefault()

    const value =
      type === 'limit' ? limits.limit_amount_gte : limits.alert_amount_gte
    if (value === null) {
      return
    }

    await updateBillingLimit(type)
    setEditMode((prev) => ({ ...prev, [type]: false }))
  }

  const renderAmountInput = (type: 'limit' | 'alert') => {
    const value =
      type === 'limit' ? limits.limit_amount_gte : limits.alert_amount_gte
    const originalValue =
      type === 'limit'
        ? originalLimits.limit_amount_gte
        : originalLimits.alert_amount_gte
    const isEditing = type === 'limit' ? editMode.limit : editMode.alert

    const buttonClasses = 'h-9 items-center'

    if (originalValue === null || isEditing) {
      return (
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="number"
              min="0"
              className="w-[9rem] rounded-md border border-white/10 text-sm focus:outline-none outline-none p-2 pr-6"
              value={value || ''}
              onChange={(e) =>
                setLimits({
                  ...limits,
                  [type === 'limit' ? 'limit_amount_gte' : 'alert_amount_gte']:
                    Number(e.target.value) || null,
                })
              }
              placeholder={`${type === 'limit' ? 'Limit' : 'Alert'} Amount`}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-white/50">
              $
            </div>
          </div>
          <Button
            type="submit"
            variant="outline"
            disabled={value === originalValue || isLoading[type].save}
            className={buttonClasses}
          >
            {isLoading[type].save ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Set'
            )}
          </Button>
          {originalValue !== null && (
            <Button
              type="button"
              variant="desctructive"
              onClick={() => deleteBillingLimit(type)}
              disabled={isLoading[type].clear}
              className={buttonClasses}
            >
              {isLoading[type].clear ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Clear'
              )}
            </Button>
          )}
        </div>
      )
    }

    return (
      <div className="flex items-center gap-2">
        <div className="text-xs text-white/50 mx-2">
          $
          <span className="text-lg font-semibold text-white">
            {originalValue}
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={(e) => {
            e.preventDefault()
            setEditMode((prev) => ({ ...prev, [type]: true }))
          }}
          className={buttonClasses}
        >
          Edit
        </Button>
        <Button
          type="button"
          variant="desctructive"
          onClick={() => deleteBillingLimit(type)}
          disabled={isLoading[type].clear}
          className={buttonClasses}
        >
          {isLoading[type].clear ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Clear'
          )}
        </Button>
      </div>
    )
  }

  return (
    <>
      <form onSubmit={(e) => handleSubmit(e, 'limit')} className="space-y-2">
        <h3 className="font-medium">Enable Budget Limit</h3>
        <p className="text-sm text-white/70">
          If your team exceeds this threshold in a given month,
          subsequent API requests will be blocked.
        </p>
        <p className="text-sm text-white/70">
          You will automatically receive email notifications when your usage
          reaches <b>50%</b>, <b>80%</b>, <b>90%</b>, and <b>100%</b> of this
          limit.
        </p>
        <p className="text-sm text-red-400">
          Caution: Enabling a Budget Limit may cause interruptions to your
          service. Once your Budget Limit is reached, your team will not be able
          to create new sandboxes in the given month unless the limit
          is increased.
        </p>
        <div className="!mt-4">{renderAmountInput('limit')}</div>
      </form>

      <form onSubmit={(e) => handleSubmit(e, 'alert')} className="space-y-2">
        <h3 className="font-medium">Set a Budget Alert</h3>
        <p className="text-sm text-white/70">
          If your team exceeds this threshold in a given month, you&apos;ll
          receive an alert notification to <b>{email}</b>.
          This will not result in any interruptions to your service.
        </p>
        <div className="!mt-4">{renderAmountInput('alert')}</div>
      </form>
    </>
  )
}
