import { forwardRef } from 'react'
import Link from 'next/link'
import clsx from 'clsx'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useIsInsideMobileNavigation } from '@/components/MobileNavigation'
import { Logo } from '@/components/Logo'
import { Auth } from '@/components/Auth'
import { HeaderSeparator } from '@/components/HeaderUtils'


// @ts-ignore
export const HeaderMain = forwardRef(function Header({ className }, ref) {
  const isInsideMobileNavigation = useIsInsideMobileNavigation()


  const { scrollY } = useScroll()
  const bgOpacityLight = useTransform(scrollY, [0, 72], [0.5, 0.9])
  const bgOpacityDark = useTransform(scrollY, [0, 72], [0.2, 0.8])

  return (
    <motion.div
      // @ts-ignore
      ref={ref}
      className={clsx(
        className,
        'fixed inset-x-0 top-0 z-50 border border-zinc-900/5 dark:border-white/5 flex h-14 items-center justify-between gap-12 px-4 transition sm:px-6 lg:z-30 lg:px-8',
        !isInsideMobileNavigation && 'backdrop-blur-sm dark:backdrop-blur',
      )}
      style={
        {
          '--bg-opacity-light': bgOpacityLight,
          '--bg-opacity-dark': bgOpacityDark,
        } as React.CSSProperties
      }
    >
    <div className="relative top-1 hidden items-start justify-start lg:flex">
        <Link href="/" aria-label="Home">
          <Logo className="h-6" />
        </Link>
    </div>
    
    <div className="flex justify-center items-center space-x-5">
      
      <div className="flex items-center justify-center text-sm space-x-3 text-neutral-400">
        <p className='hover:text-white hover:cursor-pointer'>Changelog</p>
        <Link className='hover:text-white hover:cursor-pointer' href='/docs'>
          Docs
        </Link>
        <p className='hover:text-white hover:cursor-pointer'>Blog</p>
      </div>

      <div className="flex items-center gap-5">
        <HeaderSeparator />
        <Auth />
      </div>
    </div>
   
    </motion.div>
  )
})
