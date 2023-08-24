'use client'

import { Button } from '@/components/Button';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useUser } from '@/utils/useUser';

export function ButtonLoginToken() {
  const supabase = createClientComponentClient()
  const { user, isLoading } = useUser()
  
  async function signInWithGitHub() {
    await supabase.auth.signInWithOAuth({ // redirect to GitHub
      provider: 'github',
      options: {
        redirectTo: window.location.href,
        scopes: 'email',
      }
    })
  }
  
  let extraClassName = 'duration-300'
  if (isLoading) extraClassName += ' opacity-0 pointer-events-none'
  if (user) return null

  // @ts-ignore
  return <Button
    onClick={() => signInWithGitHub()}
    variant="textTernary"
    className={extraClassName}
  >
    Login to get your API key
  </Button>
  
}
