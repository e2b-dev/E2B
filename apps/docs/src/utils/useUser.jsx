'use client'

import { useEffect, useState, createContext, useContext, useMemo } from 'react';
import { User } from '@supabase/supabase-auth-helpers/react';
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs';
import * as Sentry from "@sentry/nextjs";

/**
 * @typedef {Object} UserContextType
 * @property {boolean} isLoading
 * @property {Session|null} session
 * @property {User|null} user
 * @property {Error|null} error
 */
export const UserContext = createContext(undefined);

export const CustomUserContextProvider = (props) => {
  const supabase = createPagesBrowserClient();
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  let mounted;
  
  useEffect(() => {
    mounted = true;
    async function getSession() {
      const {
        data: { session },
        error
      } = await supabase.auth.getSession();

      if (mounted) {
        if (error) {
          setError(error);
          setIsLoading(false);
          return;
        }

        setSession(session);
        if (!session) setIsLoading(false); // if session is present, we set setLoading to false in the second useEffect
      }
    }
    void getSession();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
        setSession(session);
      }

      if (event === 'SIGNED_OUT') {
        setSession(null);
      }
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);
  
  useEffect(() => {
    async function getUserCustom() {
      const { data: teams, teamsError } = await supabase
        .from('users_teams')
        .select('*')
        .eq('user_id', session?.user.id) // Due to RLS, we could also safely just fetch all, but let's be explicit for sure
      if (teamsError) Sentry.captureException(teamsError); 
      
      const { data: apiKeys, error: apiKeysError } = await supabase
        .from('team_api_keys')
        .select('*')
        .in('team_id', teams?.map(team => team.team_id)) // Due to RLS, we could also safely just fetch all, but let's be explicit for sure
      if (apiKeysError) Sentry.captureException(apiKeysError);
      
      setUser({
        ...session?.user,
        teams,
        apiKeys,
        error: teamsError || apiKeysError
      })
      setIsLoading(false);
    }
    if (session) void getUserCustom();
  }, [session])

  /** @type {UserContextType} */
  const value = useMemo(() => {
    if (isLoading) {
      return {
        isLoading: true,
        error: null,
        session: null,
        user: null,
      };
    }

    if (error) {
      return {
        isLoading: false,
        error,
        session: null,
        user: null,
      };
    }

    return {
      isLoading: false,
      error: null,
      session,
      user,
    };
  }, [isLoading, user, session, error]);
  
  return <UserContext.Provider value={value} {...props} />;
};

/**
 * @returns {UserContextType} user
 */
export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) throw new Error(`useUser must be used within a CustomUserContextProvider.`);
  return context;
};

/**
 * @returns {string} apiKey
 */
export const useApiKey = () => {
  const { user } = useUser();
  return user?.apiKeys?.[0]?.api_key;
}
