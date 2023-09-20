'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { User } from '@supabase/supabase-auth-helpers/react'
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs'
import { type Session } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'
import { useSessionsStore } from './useSessions'
import { LangShort } from './consts'

type UserContextType = {
  isLoading: boolean
  session: Session | null
  user:
    | (User & {
        teams: any[]
        apiKeys: any[]
        accessToken: string
        defaultTeamId: string
      })
    | null
  error: Error | null
}

export const UserContext = createContext(undefined)

export const CustomUserContextProvider = props => {
  const supabase = createPagesBrowserClient()
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const mounted = useRef<boolean>(false)
  const initSession = useSessionsStore(state => state.initSession)

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
        (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')
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
      // @ts-ignore
      const { data: teams, teamsError } = await supabase
        .from('users_teams')
        .select('*')
        .eq('user_id', session?.user.id) // Due to RLS, we could also safely just fetch all, but let's be explicit for sure
      if (teamsError) Sentry.captureException(teamsError)

      const { data: apiKeys, error: apiKeysError } = await supabase
        .from('team_api_keys')
        .select('*')
        .in('team_id', teams?.map(team => team.team_id)) // Due to RLS, we could also safely just fetch all, but let's be explicit for sure
      if (apiKeysError) Sentry.captureException(apiKeysError)

      // as soon as we have apiKey, start initializing sessions, so they are ready when user wanna use them
      const apiKey = apiKeys?.[0]?.api_key
      if (apiKey) {
        // We don't care about awaiting these, we just want to start them
        void initSession(LangShort.js, apiKey)
        void initSession(LangShort.py, apiKey)
      }

      const defaultTeamId = teams?.[0]?.team_id // TODO: Adjust when user can be part of multiple teams

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
      session,
      user,
    }
  }, [isLoading, user, session, error])

  return (
    <UserContext.Provider
      value={value}
      {...props}
    />
  )
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
