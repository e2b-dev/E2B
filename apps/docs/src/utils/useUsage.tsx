'use client'

import {
  useEffect,
  useState,
  useCallback,
} from 'react'

import { useUser } from '@/utils/useUser'
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs'

export interface MonthlyCosts {
  month: number
  year: number
  total_costs: number
  unpaid_costs: number
}

export function useUsage() {
  const { user } = useUser()
  const [credits, setCredits] = useState(null)
  const [costs, setCosts] = useState<MonthlyCosts[]>([])
  const supabase = createPagesBrowserClient()

  const fetchCredits = useCallback(async function fetchCredits() {
    if (!user) return
    const { teams } = user
    if (!teams || !supabase) return
    if (teams.length === 0) return

    // const teamID = teams[0].id

    // TODO: Fetch from API server
    setCredits(100)
    setCosts([
      {
        month: 2,
        year: 2024,
        total_costs: 23.85,
        unpaid_costs: 23.85,
      },
      {
        month: 1,
        year: 2024,
        total_costs: 232,
        unpaid_costs: 0,
      },
      {
        month: 12,
        year: 2023,
        total_costs: 32.221,
        unpaid_costs: 0,
      },
    ])

  }, [user, supabase])

  useEffect(function () {
    fetchCredits()
  }, [fetchCredits])

  return {
    credits,
    costs,
  }
}