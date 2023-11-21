'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { User } from '@supabase/supabase-auth-helpers/react'
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs'
import { type Session } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'
import { useSandboxStore } from './useSandbox'

type Team = {
  id: string,
  name: string,
  is_default: boolean
}

type UserContextType = {
  isLoading: boolean;
  session: Session | null;
  user:
  | (User & {
    teams: Team[];
    apiKeys: any[];
    accessToken: string;
    defaultTeamId: string;
    pricingTier: {
      id: string,
      isPromo: boolean,
      endsAt: string
    }
  })
  | null;
  error: Error | null;
};

export const UserContext = createContext(undefined)

export const CustomUserContextProvider = (props) => {
  const supabase = createPagesBrowserClient()
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState(null)
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const mounted = useRef<boolean>(false)
  const initSandbox = useSandboxStore((state) => state.initSandbox)

  useEffect(() => {
    mounted.current = true

    async function getSession() {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession()

      if (mounted.current) {
        if (error) {
          setError(error)
          setIsLoading(false)
          return
        }

        setSession(session)
        if (!session) setIsLoading(false) // if session is present, we set setLoading to false in the second useEffect
      }
    }

    void getSession()
    return () => {
      mounted.current = false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        session &&
        (event === 'SIGNED_IN' ||
          event === 'TOKEN_REFRESHED' ||
          event === 'USER_UPDATED')
      ) {
        setSession(session)
      }

      if (event === 'SIGNED_OUT') {
        setSession(null)
      }
    })
    return () => {
      subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    async function getUserCustom() {
      if (!session) return
      if (!session.user.id) return

      // @ts-ignore
      const { data: userTeams, teamsError } = await supabase
        .from('users_teams')
        .select('teams (id, name, is_default)')
        .eq('user_id', session?.user.id) // Due to RLS, we could also safely just fetch all, but let's be explicit for sure
      if (teamsError) Sentry.captureException(teamsError)
      // TODO: Adjust when user can be part of multiple teams
      // @ts-ignore
      const teams = userTeams?.map(userTeam => userTeam.teams as Team)
      const defaultTeam = teams?.find(team => team.is_default)

      if (!defaultTeam) {
        console.error('No default team found for user', session?.user.id)
        return
      }

      // Fetch user's pricing tier
      const { data, error: pricingTierError } = await supabase
        .from('teams')
        .select('tier')
        .eq('id', defaultTeam.id)
      if (pricingTierError) Sentry.captureException(pricingTierError)
      const pricingTier: string | undefined = data?.[0]?.tier

      if (!pricingTier) {
        console.error('No pricing tier found for team', defaultTeam.id)
        return
      }

      const isPromoTier = pricingTier.startsWith('promo')
      let promoEndsAt: string | null = null
      // Fetch promo end date
      if (isPromoTier) {
        console.log('pricingTier', pricingTier)
        const { data: promoData, error: promoError } = await supabase
          .from('tiers')
          .select('promo_ends_at')
          .eq('id', pricingTier)
        if (promoError) Sentry.captureException(promoError)
        console.log('promoData', promoData)
        promoEndsAt = promoData?.[0]?.promo_ends_at
      }

      const { data: apiKeys, error: apiKeysError } = await supabase
        .from('team_api_keys')
        .select('*')
        .in('team_id', teams?.map((team) => team.id)) // Due to RLS, we could also safely just fetch all, but let's be explicit for sure
      if (apiKeysError) Sentry.captureException(apiKeysError)

      // as soon as we have apiKey, start initializing sandboxes, so they are ready when user want to use them
      const apiKey = apiKeys?.[0]?.api_key
      if (apiKey) {
        // We don't care about awaiting this, we just want to start it
        void initSandbox(apiKey)
      }

      const defaultTeamId = defaultTeam?.id // TODO: Adjust when user can be part of multiple teams

      const { data: accessToken, error: accessTokenError } = await supabase
        .from('access_tokens')
        .select('*')
        .eq('user_id', session?.user.id) // Due to RLS, we could also safely just fetch all, but let's be explicit for sure
        .limit(1)
        .single()
      if (accessTokenError) Sentry.captureException(accessTokenError)

      setUser({
        ...session?.user,
        teams,
        apiKeys,
        accessToken: accessToken?.access_token,
        defaultTeamId,
        error: teamsError || apiKeysError,
        pricingTier: {
          id: pricingTier,
          isPromo: isPromoTier,
          endsAt: promoEndsAt,
        },
      })
      setIsLoading(false)
    }

    if (session) void getUserCustom()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  const value: UserContextType = useMemo(() => {
    if (isLoading) {
      return {
        isLoading: true,
        error: null,
        session: null,
        user: null,
      }
    }

    if (error) {
      return {
        isLoading: false,
        error,
        session: null,
        user: null,
      }
    }

    return {
      isLoading: false,
      error: null,
      session: session,
      user,
    }
  }, [isLoading, user, session, error])

  return <UserContext.Provider value={value} {...props} />
}

export const useUser = (): UserContextType => {
  const context = useContext(UserContext)
  if (context === undefined)
    throw new Error('useUser must be used within a CustomUserContextProvider.')
  return context
}

export const useApiKey = (): string => {
  // for convenience
  const { user } = useUser()
  return user?.apiKeys?.[0]?.api_key
}

export const useAccessToken = (): string => {
  // for convenience
  const { user } = useUser()
  return user?.accessToken
}
