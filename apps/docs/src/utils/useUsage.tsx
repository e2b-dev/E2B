'use client'

import {
  useEffect,
  useState,
  useCallback,
} from 'react'

import { useApiKey, useUser } from '@/utils/useUser'
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs'

export interface MonthlyCosts {
  month: number
  year: number
  total_cost: number
  unpaid_cost: number
}

const usageUrl = `${process.env.NEXT_PUBLIC_BILLING_API_URL}/usage`

export function useUsage() {
  const { user } = useUser()
  const apiKey = useApiKey()
  const [credits, setCredits] = useState<number | null>(null)
  const [usage, setUsage] = useState<MonthlyCosts[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createPagesBrowserClient()

  const fetchCredits = useCallback(async function fetchCredits() {
    if (!user) return
    const { teams } = user
    if (!teams || !supabase) return
    if (teams.length === 0) return
    if (!apiKey) return

    const teamUsage = await
      fetch(usageUrl, {
        headers: {
          'X-Team-API-Key': apiKey,
        },
      }).then(res => res.json())

    setCredits(teamUsage.credits)
    setUsage(teamUsage.usages as MonthlyCosts[])
    setIsLoading(false)
  }, [user, supabase, apiKey])

  useEffect(function () {
    fetchCredits()
  }, [fetchCredits])

  return {
    credits,
    usage,
    isLoading,
  }
}