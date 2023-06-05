import { useUser } from '@supabase/auth-helpers-react'
import clsx from 'clsx'
import { Inter } from 'next/font/google'
import { PropsWithChildren, useEffect } from 'react'
import { usePostHog } from 'posthog-js/react'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

function Layout({ children }: PropsWithChildren) {
  const user = useUser()
  const posthog = usePostHog()

  useEffect(function identifyUser() {
    if (user) {
      posthog?.identify(user.id, {
        email: user.email,
      })
    }
  }, [posthog, user])

  return (
    <div className={clsx(
      inter.variable,
      'font-sans',
      'flex',
      'h-full',
      'w-full',
      'flex-1',
      'flex-col',
      'overflow-hidden',
    )}>
      {children}
    </div>
  )
}

export default Layout
