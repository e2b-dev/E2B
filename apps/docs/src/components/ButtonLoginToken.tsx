'use client'

import { Button } from '@/components/Button'
import { useUser } from '@/utils/useUser'
import { useSignIn } from '@/utils/useSignIn'

export function ButtonLoginToken() {
  const { user, isLoading } = useUser()
  const signIn = useSignIn()

  let extraClassName = 'duration-300'
  if (isLoading) extraClassName += ' opacity-0 pointer-events-none'
  if (user) return null

  return (
    <Button
      onClick={() => signIn()}
      variant="textTernary"
      className={extraClassName}
    >
      Sign up to get your API key
    </Button>
  )
}
