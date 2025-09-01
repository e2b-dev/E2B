'use client'

import { Children, isValidElement } from 'react'
import { Tab } from '@headlessui/react'
import {
  CodeGroupHeader,
  getPanelTitle,
  useTabGroupProps,
} from '@/components/Code'

export interface Props {
  children: JSX.Element[]
  title: string
  isFileName?: boolean
}

export function LanguageSpecificText({
  children,
  title,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isFileName,
}: Props) {
  const languages =
    Children.map(children, (child) =>
      getPanelTitle(isValidElement(child) ? child.props : ({} as any))
    ) ?? []
  const tabGroupProps = useTabGroupProps(languages)

  const containerClassName =
    'not-prose my-6 overflow-hidden rounded-2xl bg-zinc-900 shadow-md dark:ring-1 dark:ring-white/10'
  const header = (
    <CodeGroupHeader
      title={title}
      selectedIndex={tabGroupProps.selectedIndex}
      // isFileName={isFileName}
    >
      {children}
    </CodeGroupHeader>
  )

  return (
    <div>
      <Tab.Group {...tabGroupProps} className={containerClassName}>
        {header}
        <div>
          <div className="group dark:bg-white/2.5">
            <div className="relative">
              <div
                className="text-s overflow-x-auto p-4 text-white"
                style={{ whiteSpace: 'pre-line' }}
              >
                {children[tabGroupProps.selectedIndex].props.text}
              </div>
            </div>
          </div>
        </div>
      </Tab.Group>
    </div>
  )
}
