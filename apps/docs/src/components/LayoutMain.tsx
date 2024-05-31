'use client'

import clsx from 'clsx'
import { usePathname } from 'next/navigation'

import { FooterMain } from '@/components/Footer'
import { Banner } from '@/components/Banner'
import { useUser } from '@/utils/useUser'
import { HeaderMain } from './HeaderMain'

export function LayoutMain({
  children,
}: {
  children: React.ReactNode
}) {
  const { user } = useUser()
  const pathname = usePathname()
  const relativePathname = pathname?.replace(new RegExp('^/docs'), '')
  const shouldShowBanner = user?.pricingTier.isPromo
  const isAuth = relativePathname?.startsWith('/sign-in')

  return (
      <div className={clsx('h-full w-full flex flex-col')}>
        
        {/* @ts-ignore */}
        <HeaderMain isAuth={isAuth} />
        {/* {!isAuth && <Navigation className="hidden lg:my-4 lg:block" />} */}

        {shouldShowBanner && <Banner />}

        <main className="w-full h-full flex flex-col">
          {children}
        </main>

        <FooterMain />
 
      </div>
  )
}


