'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { User } from '@supabase/supabase-auth-helpers/react'
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs'
import { type Session } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'

export type Team = {
  id: string
  name: string
  tier: string
  is_default: boolean
  email: string
  apiKeys: string[]
  is_blocked: boolean
  blocked_reason: string
}

interface APIKey {
  api_key: string
}
interface UserTeam {
  is_default: boolean
  teams: {
    tier: string
    email: string
    team_api_keys: { api_key: string }[]
    id: string
    name: string
    is_blocked: boolean
    blocked_reason: string
  }
}

export type E2BUser = User & {
  teams: Team[]
  accessToken: string
  defaultTeamId: string
}

type UserContextType = {
  isLoading: boolean
  session: Session | null
  user: E2BUser | null
  error: Error | null
  wasUpdated: boolean | null
}

export const UserContext = createContext(undefined)

export const CustomUserContextProvider = (props) => {
  const supabase = createPagesBrowserClient()
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<any>()
  const [error, setError] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const mounted = useRef<boolean>(false)

  const [wasUpdated, setWasUpdated] = useState<boolean | null>(null)

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
        if (event === 'USER_UPDATED') {
          setWasUpdated(true)
        }
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

      const { data: userTeams, error: teamsError } = await supabase
        .from('users_teams')
        .select(
          'is_default, teams (id, name, tier, is_blocked, blocked_reason, email, team_api_keys (api_key))'
        )
        .eq('user_id', session?.user.id) // Due to RLS, we could also safely just fetch all, but let's be explicit for sure

      if (teamsError) Sentry.captureException(teamsError)

      if (userTeams === undefined || userTeams === null) {
        console.log('No user teams found')
        Sentry.captureEvent({ message: 'No user teams found' })
        return
      }

      const typedUserTeams = userTeams as unknown as UserTeam[]
      const teams: Team[] = typedUserTeams.map((userTeam: UserTeam): Team => {
        return {
          id: userTeam.teams.id,
          name: userTeam.teams.name,
          tier: userTeam.teams.tier,
          is_default: userTeam.is_default,
          email: userTeam.teams.email,
          apiKeys: userTeam.teams.team_api_keys.map(
            (apiKey: APIKey) => apiKey.api_key
          ),
          is_blocked: userTeam.teams.is_blocked,
          blocked_reason: userTeam.teams.blocked_reason,
        }
      })
      const defaultTeam = teams?.find((team) => team.is_default)

      if (!defaultTeam) {
        console.error('No default team found for user', session?.user.id)
        return
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
        teams: teams ?? [],
        accessToken: accessToken?.access_token,
        defaultTeamId,
        error: teamsError,
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
        wasUpdated: null,
      }
    }

    if (error) {
      return {
        isLoading: false,
        error,
        session: null,
        user: null,
        wasUpdated: null,
      }
    }

    return {
      isLoading: false,
      error: null,
      session: session,
      user,
      wasUpdated,
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
  return user ? user?.teams[0].apiKeys[0] : ''
}

export const useAccessToken = () => {
  // for convenience
  const { user } = useUser()
  return user?.accessToken
}
