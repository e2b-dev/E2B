'use client'

import clsx from 'clsx'
import { motion } from 'framer-motion'
import { usePathname, useRouter } from 'next/navigation'
import React, { useRef, useState } from 'react'

import { useIsInsideMobileNavigation } from '@/components/MobileBurgerMenu'
import { useSectionStore } from '@/components/SectionProvider'
import { SdkVersionSelect } from '@/components/SdkVersionSelect'
import { NavigationLink } from './NavigationLink'
import { NavigationSubgroup } from './NavigationSubgroup'
import {
  NavGroup,
  NavLink,
  NavSubgroup,
  VersionedNavGroup,
  docRoutes,
  sdkRefRoutes,
} from './routes'

function useInitialValue<T>(value: T, condition = true) {
  const initialValue = useRef(value).current
  return condition ? initialValue : value
}

function NavigationGroup({
  group,
  className,
  isLast,
}: {
  group: NavGroup
  className?: string
  isLast?: boolean
}) {
  // If this is the mobile navigation then we always render the initial
  // state, so that the state does not change during the close animation.
  // The state will still update when we re-open (re-render) the navigation.
  const isInsideMobileNavigation = useIsInsideMobileNavigation()
  const initialPathname = usePathname()
  const [pathname] = useInitialValue(
    [initialPathname, useSectionStore((s) => s.sections)],
    isInsideMobileNavigation
  )
  if (!pathname) {
    return null
  }

  return (
    <li className={clsx('relative', className)}>
      <div className="pl-2 mb-1 flex items-center justify-start gap-1">
        <motion.h2
          layout="position"
          className="text-2xs font-medium text-white"
        >
          {group.title}
        </motion.h2>
      </div>
      <div className="relative">
        <ul role="list" className="border-l border-transparent">
          <>
            {group.items?.map((item) => (
              <React.Fragment key={item.title}>
                {(item as any).links ? (
                  <NavigationSubgroup subgroup={item as NavSubgroup} />
                ) : (
                  <NavigationLink
                    link={item as NavLink}
                    className="font-medium"
                  />
                )}
              </React.Fragment>
            ))}
          </>
        </ul>
      </div>
      {!isLast && (
        // Visual separator
        <div className="ml-2 h-px bg-white/5 my-4"></div>
      )}
    </li>
  )
}

function VersionedNavigationGroup({
  group,
  className,
  isLast,
}: {
  group: VersionedNavGroup
  className?: string
  isLast?: boolean
}) {
  const router = useRouter()

  // Manage the state of the current version of the SDK reference
  const versions = Object.keys(group.versionedItems)
  const [curVersion, setCurVersion] = useState(versions[0])

  // If this is the mobile navigation then we always render the initial
  // state, so that the state does not change during the close animation.
  // The state will still update when we re-open (re-render) the navigation.
  const isInsideMobileNavigation = useIsInsideMobileNavigation()
  const initialPathname = usePathname()
  const [pathname] = useInitialValue(
    [initialPathname, useSectionStore((s) => s.sections)],
    isInsideMobileNavigation
  )
  if (!pathname) {
    return null
  }

  return (
    <li className={clsx('relative', className)}>
      <div className="pl-2 mb-1 flex flex-col items-start justify-between gap-1">
        <motion.h2
          layout="position"
          className="text-2xs font-medium text-white"
        >
          {group.title}
        </motion.h2>
        <SdkVersionSelect
          selectedVersion={curVersion}
          versions={versions}
          onVersionChange={(version) => {
            setCurVersion(version)
            if (pathname !== '/docs/sdk-reference') {
              const pathParts = pathname.split('/')
              pathParts[pathParts.length - 2] = version
              router.push(pathParts.join('/'))
            }
          }}
        />
      </div>
      <div className="relative">
        <ul role="list" className="border-l border-transparent">
          <>
            {group.versionedItems[curVersion]?.map((item) => (
              <React.Fragment key={item.title}>
                {(item as any).links ? (
                  <NavigationSubgroup subgroup={item as NavSubgroup} />
                ) : (
                  <NavigationLink
                    link={item as NavLink}
                    className="font-medium"
                  />
                )}
              </React.Fragment>
            ))}
          </>
        </ul>
      </div>
      {!isLast && (
        // Visual separator
        <div className="ml-2 h-px bg-white/5 my-4"></div>
      )}
    </li>
  )
}

export function DocsNavigation(props) {
  return (
    <nav {...props}>
      <ul role="list">
        {docRoutes.map((group, groupIndex) => (
          <NavigationGroup
            key={groupIndex}
            group={group}
            className={groupIndex === 0 ? 'md:mt-0' : undefined}
            isLast={groupIndex === docRoutes.length - 1}
          />
        ))}
      </ul>
    </nav>
  )
}

export function SdkRefNavigation(props) {
  return (
    <nav {...props}>
      <ul role="list">
        {sdkRefRoutes.map((group, groupIndex) => (
          <VersionedNavigationGroup
            key={groupIndex}
            group={group}
            className={groupIndex === 0 ? 'md:mt-0' : undefined}
            isLast={groupIndex === docRoutes.length - 1}
          />
        ))}
      </ul>
    </nav>
  )
}
