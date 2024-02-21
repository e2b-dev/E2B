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
const creditsUrl = `${process.env.NEXT_PUBLIC_BILLING_API_URL}/credits`

export function useUsage() {
  const { user } = useUser()
  const apiKey = useApiKey()
  const [credits, setCredits] = useState(null)
  const [usage, setUsage] = useState<MonthlyCosts[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createPagesBrowserClient()

  const fetchCredits = useCallback(async function fetchCredits() {
    if (!user) return
    const { teams } = user
    if (!teams || !supabase) return
    if (teams.length === 0) return
    if (!apiKey) return

    const [
      { credits: c },
      u,
    ] = await Promise.all([
      fetch(creditsUrl, {
        headers: {
          'X-Team-API-Key': apiKey,
        },
      }).then(res => res.json()),
      fetch(usageUrl, {
        headers: {
          'X-Team-API-Key': apiKey,
        },
      }).then(res => res.json()),
    ])

    setCredits(c)
    setUsage(u)
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