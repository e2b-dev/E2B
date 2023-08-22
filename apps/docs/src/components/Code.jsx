'use client'

import { Children, createContext, useContext, useEffect, useRef, useState, } from 'react'
import { Tab } from '@headlessui/react'
import clsx from 'clsx'
import { create } from 'zustand'

import { Tag } from '@/components/Tag'
import { CopyButton } from '@/components/CopyButton';
import { useApiKey } from '@/utils/useUser';

const languageNames = {
  js: 'JavaScript',
  ts: 'TypeScript',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  php: 'PHP',
  python: 'Python',
  ruby: 'Ruby',
  go: 'Go',
}

function getPanelTitle({ title, language }) {
  return title ?? languageNames[language] ?? 'Code'
}

function CodePanelHeader({ tag, label }) {
  if (!tag && !label) {
    return null
  }

  return (
    <div className="flex h-9 items-center gap-2 border-y border-b-white/7.5 border-t-transparent bg-white/2.5 bg-zinc-900 px-4 dark:border-b-white/5 dark:bg-white/1">
      {tag && (
        <div className="dark flex">
          <Tag variant="small">{tag}</Tag>
        </div>
      )}
      {tag && label && (
        <span className="h-0.5 w-0.5 rounded-full bg-zinc-500" />
      )}
      {label && (
        <span className="font-mono text-xs text-zinc-400">{label}</span>
      )}
    </div>
  )
}

function CodePanel({ tag, label, code, children }) {
  let child = Children.only(children)

  return (
    <div className="group dark:bg-white/2.5">
      <CodePanelHeader
        tag={child.props.tag ?? tag}
        label={child.props.label ?? label}
      />
      <div className="relative">
        <pre className="overflow-x-auto p-4 text-xs text-white">{children}</pre>
        <CopyButton code={child.props.code ?? code} />
      </div>
    </div>
  )
}

function CodeGroupHeader({ title, children, selectedIndex }) {
  let hasTabs = Children.count(children) > 1

  if (!title && !hasTabs) {
    return null
  }

  return (
    <div className="flex min-h-[calc(theme(spacing.12)+1px)] flex-wrap items-start gap-x-4 border-b border-zinc-700 bg-zinc-800 px-4 dark:border-zinc-800 dark:bg-transparent">
      {title && (
        <h3 className="mr-auto pt-3 text-xs font-semibold text-white">
          {title}
        </h3>
      )}
      {hasTabs && (
        <Tab.List className="-mb-px flex gap-4 text-xs font-medium">
          {Children.map(children, (child, childIndex) => (
            <Tab
              className={clsx(
                'border-b py-3 transition ui-not-focus-visible:outline-none',
                childIndex === selectedIndex
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-300'
              )}
            >
              {getPanelTitle(child.props)}
            </Tab>
          ))}
        </Tab.List>
      )}
    </div>
  )
}

function CodeGroupPanels({ children, ...props }) {
  let hasTabs = Children.count(children) > 1

  if (hasTabs) {
    return (
      <Tab.Panels>
        {Children.map(children, (child) => (
          <Tab.Panel>
            <CodePanel {...props}>{child}</CodePanel>
          </Tab.Panel>
        ))}
      </Tab.Panels>
    )
  }

  return <CodePanel {...props}>{children}</CodePanel>
}

function usePreventLayoutShift() {
  let positionRef = useRef()
  let rafRef = useRef()

  useEffect(() => {
    return () => {
      window.cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return {
    positionRef,
    preventLayoutShift(callback) {
      let initialTop = positionRef.current.getBoundingClientRect().top

      callback()

      rafRef.current = window.requestAnimationFrame(() => {
        let newTop = positionRef.current.getBoundingClientRect().top
        window.scrollBy(0, newTop - initialTop)
      })
    },
  }
}

const usePreferredLanguageStore = create((set) => ({
  preferredLanguages: [],
  addPreferredLanguage: (language) =>
    set((state) => ({
      preferredLanguages: [
        ...state.preferredLanguages.filter(
          (preferredLanguage) => preferredLanguage !== language
        ),
        language,
      ],
    })),
}))

function useTabGroupProps(availableLanguages) {
  let { preferredLanguages, addPreferredLanguage } = usePreferredLanguageStore()
  let [selectedIndex, setSelectedIndex] = useState(0)
  let activeLanguage = [...availableLanguages].sort(
    (a, z) => preferredLanguages.indexOf(z) - preferredLanguages.indexOf(a)
  )[0]
  let languageIndex = availableLanguages.indexOf(activeLanguage)
  let newSelectedIndex = languageIndex === -1 ? selectedIndex : languageIndex
  if (newSelectedIndex !== selectedIndex) {
    setSelectedIndex(newSelectedIndex)
  }

  let { positionRef, preventLayoutShift } = usePreventLayoutShift()

  return {
    as: 'div',
    ref: positionRef,
    selectedIndex,
    onChange: (newSelectedIndex) => {
      preventLayoutShift(() =>
        addPreferredLanguage(availableLanguages[newSelectedIndex])
      )
    },
  }
}

const CodeGroupContext = createContext(false)

export function CodeGroup({ children, title, ...props }) {
  let languages = Children.map(children, (child) => getPanelTitle(child.props))
  let tabGroupProps = useTabGroupProps(languages)
  let hasTabs = Children.count(children) > 1
  let Container = hasTabs ? Tab.Group : 'div'
  let containerProps = hasTabs ? tabGroupProps : {}
  let headerProps = hasTabs
    ? { selectedIndex: tabGroupProps.selectedIndex }
    : {}

  return (
    <CodeGroupContext.Provider value={true}>
      <Container
        {...containerProps}
        className="not-prose my-6 overflow-hidden rounded-2xl bg-zinc-900 shadow-md dark:ring-1 dark:ring-white/10"
      >
        <CodeGroupHeader title={title} {...headerProps}>
          {children}
        </CodeGroupHeader>
        <CodeGroupPanels {...props}>{children}</CodeGroupPanels>
      </Container>
    </CodeGroupContext.Provider>
  )
}

export function Code({ children, ...props }) {
  let isGrouped = useContext(CodeGroupContext)
  
  /* <DYNAMIC-API-REPLACEMENT> */
  // let apiKey = useApiKey()
  // if (children.replace && apiKey) children = children.replace(`{{API_KEY}}`, `${apiKey}`)
  /* </DYNAMIC-API-REPLACEMENT> */

  if (isGrouped) {
    return <code {...props} dangerouslySetInnerHTML={{ __html: children }} />
  }

  return <code {...props}>{children}</code>
}

export function Pre({ children, ...props }) {
  let isGrouped = useContext(CodeGroupContext)

  if (isGrouped) {
    return children
  }

  return <CodeGroup {...props}>{children}</CodeGroup>
}
