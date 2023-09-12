'use client'

import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
} from 'react'
import { Tab } from '@headlessui/react'
import clsx from 'clsx'
import { create } from 'zustand'
import { LoaderIcon, PlayIcon } from 'lucide-react'

import { CopyButton } from '@/components/CopyButton'
import {useApiKey, useUser} from '@/utils/useUser'
import { ProcessMessage } from '@e2b/sdk'
import { useSessionsStore } from '@/utils/useSessions'
import { useSignIn } from '@/utils/useSignIn'
import { LangShort, languageNames, mdLangToLangShort } from '@/utils/consts'
import { usePostHog } from "posthog-js/react";

export function getPanelTitle({
  title,
  language,
}: {
  title?: string
  language?: string
}) {
  if (title) {
    return title
  }
  if (language && language in languageNames) {
    return languageNames[language]
  }
  return 'Code'
}

function CodePanel({
  children,
  code,
  lang,
  isRunnable = true,
}: {
  children: React.ReactNode
  code?: string
  lang?: LangShort
  isRunnable?: boolean
}) {
  const signIn = useSignIn()
  const apiKey = useApiKey()
  const posthog = usePostHog()
  
  const codeGroupContext = useContext(CodeGroupContext) 
  
  const sessionDef = useSessionsStore((s) => s.sessions[lang])
  const initSession = useSessionsStore((s) => s.initSession)
  const { outputLines, dispatch } = useOutputReducer()
  const [isRunning, setIsRunning] = useState(false)

  function appendOutput(out: ProcessMessage) {
    dispatch({ type: 'push', payload: out.line })
  }

  function filterAndMaybeAppendOutput(out: ProcessMessage) {
    if (out.line.includes('Cannot refresh session')) return
    if (out.line.includes(`Trying to reconnect`)) return
    console.log(`⚠️ Session stderr ${out.line}`)
    // appendOutput(out) // TODO: Reconsider logging to console after making the runs more stable
  }

  function handleSessionCreationError(err: Error) {
    console.error(err)
    setIsRunning(false)
    dispatch({ type: 'clear' })
  }

  async function onRun() {
    if (!apiKey) {
      window.alert('You need to sign in to run code snippets')
      void signIn()
      return
    }
    dispatch({ type: 'clear' })
    setIsRunning(true)
    posthog?.capture('run code snippet', {
      language: lang,
      snippetPath: codeGroupContext?.path ?? 'unknown snippet',
    })


    let session = sessionDef?.session
    try {
      if (!session) {
        if (sessionDef?.promise) {
          console.log(
            `Session for "${lang}" is still opening, waiting...`
          )
          session = await sessionDef.promise
        } else {
          console.log(
            `Session not ready yet for "${lang}", opening...`
          )
          session = await initSession(lang, apiKey)
        }
      }
    } catch (err) {
      handleSessionCreationError(err)
      return
    }

    let runtime = `E2B_API_KEY=${apiKey}`
    if (lang === LangShort.js) {
      runtime += ' node'
      const filename = '/code/index.js'
      await session.filesystem.write(filename, code)
      session.process.start({
        cmd: `${runtime} ${filename}`,
        onStdout: appendOutput,
        onStderr: filterAndMaybeAppendOutput,
        onExit: () => setIsRunning(false), // TODO: Inspect why it's exiting so late
      })
    } else if (lang === LangShort.py) {
      runtime += ' python3'
      const filename = '/main.py'
      await session.filesystem.write(filename, code)
      session.process.start({
        cmd: `${runtime} ${filename}`,
        rootdir: '/code',
        onStdout: appendOutput,
        onStderr: filterAndMaybeAppendOutput,
        onExit: () => setIsRunning(false),
      })
    } else {
      throw new Error('Unsupported runtime for playground')
    }
  }

  let child = Children.only(children)
  if (isValidElement(child)) code = child.props.code ?? code // Get code from child if available
  // @ts-ignore
  if (isValidElement(child)) lang = mdLangToLangShort[child.props.language ?? lang] // Get lang from child if available
  if (!code) throw new Error('`CodePanel` requires a `code` prop, or a child with a `code` prop.')

  
  return (
    <div className="group dark:bg-white/2.5 relative">
      <div className="
        absolute
        top-[-40px]
        right-3
      ">
        {(isRunnable) && (
          <button
            className={clsx(`
                group
                flex cursor-pointer
                items-center
                space-x-2 rounded-md bg-transparent p-1 transition-all
                text-xs
              `, 
              isRunning && `cursor-wait`
            )}
            disabled={isRunning}
            onClick={onRun}
          >
            {isRunning ? <>
              <span>Running</span>
              <LoaderIcon
                className="h-4 w-4 animate-spin text-emerald-400 transition-all group-hover:text-emerald-300"
                strokeWidth={2.5}
              />
            </> : <>
                <span>Run</span>
                <PlayIcon
                  className="h-4 w-4 text-emerald-400 transition-all group-hover:text-emerald-300"
                  strokeWidth={2.5}
                />
              </>
            }
          </button>
        )}
      </div>

      <pre className="overflow-x-auto p-4 text-xs text-white">{children}</pre>
      {(outputLines.length > 0 || isRunning) && (
        <div className="flex max-h-[200px] flex-col items-start justify-start bg-zinc-800 px-4 py-1 font-mono">
          <span className="font-mono text-xs text-zinc-500">
            Output
          </span>
          <pre className="h-full w-full overflow-auto whitespace-pre text-xs text-white">
            {outputLines.join('\n')}
          </pre>
        </div>
      )}
      <CopyButton code={code} />
    </div>
  )
}

export function CodeGroupHeader({
  title,
  children,
  selectedIndex,
}: {
  title: string
  children: React.ReactNode
  selectedIndex: number
}) {
  let hasTabs = Children.count(children) > 1
  if (!title && !hasTabs) return null

  return (
    <div className="flex min-h-[calc(theme(spacing.12)+1px)] flex-wrap items-center justify-between gap-x-4 border-b border-zinc-700 bg-zinc-800 px-4 dark:border-zinc-800 dark:bg-transparent">
      <div className="flex items-start space-x-4">
        {title && (
          <h3 className="mr-auto pt-3 text-xs font-semibold text-white">
            {title}
          </h3>
        )}
        {hasTabs && (
          <Tab.List className="-mb-px flex gap-4 text-xs font-medium">
            {Children.map(children, (child, childIndex) => (
              <Tab
                /* Set ID due to bug in Next https://github.com/vercel/next.js/issues/53110 */
                /* Should ne fixed after updating Next to > 13.4.12 */
                id={`code-tab-${childIndex}`}
                className={clsx(
                  'border-b py-3 transition ui-not-focus-visible:outline-none',
                  childIndex === selectedIndex
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-zinc-400 hover:text-zinc-300'
                )}
              >
                {getPanelTitle(isValidElement(child) ? child.props : {})}
              </Tab>
            ))}
          </Tab.List>
        )}
      </div>
    </div>
  )
}

function CodeGroupPanels({
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof CodePanel>) {
  let hasTabs = Children.count(children) > 1

  if (hasTabs) {
    return (
      <Tab.Panels>
        {/* Set ID due to bug in Next https://github.com/vercel/next.js/issues/53110 */}
        {/* Should ne fixed after updating Next to > 13.4.12 */}
        {Children.map(children, (child, childIndex) => {
          
          return (
            <Tab.Panel id={`code-tab-${childIndex}`}>
              <CodePanel {...props}>{child}</CodePanel>
            </Tab.Panel>
          )
        })}
      </Tab.Panels>
    )
  }

  return <CodePanel {...props}>{children}</CodePanel>
}

function usePreventLayoutShift() {
  let positionRef = useRef<HTMLElement>(null)
  let rafRef = useRef<number>()

  useEffect(() => {
    return () => {
      if (typeof rafRef.current !== 'undefined') {
        window.cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  return {
    positionRef,
    preventLayoutShift(callback: () => void) {
      if (!positionRef.current) {
        return
      }

      let initialTop = positionRef.current.getBoundingClientRect().top

      callback()

      rafRef.current = window.requestAnimationFrame(() => {
        let newTop =
          positionRef.current?.getBoundingClientRect().top ?? initialTop
        window.scrollBy(0, newTop - initialTop)
      })
    },
  }
}

const usePreferredLanguageStore = create<{
  preferredLanguages: Array<string>
  addPreferredLanguage: (language: string) => void
}>()((set) => ({
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

export function useTabGroupProps(availableLanguages: Array<string>) {
  let { preferredLanguages, addPreferredLanguage } = usePreferredLanguageStore()
  let [selectedIndex, setSelectedIndex] = useState(0)
  let activeLanguage = [...availableLanguages].sort(
    (a, z) => preferredLanguages.indexOf(z) - preferredLanguages.indexOf(a)
  )[0]

  let languageIndex = availableLanguages.indexOf(activeLanguage)
  let newSelectedIndex = languageIndex === -1 ? selectedIndex : languageIndex
  if (newSelectedIndex !== selectedIndex) setSelectedIndex(newSelectedIndex)

  let { positionRef, preventLayoutShift } = usePreventLayoutShift()

  return {
    as: 'div' as const,
    ref: positionRef,
    selectedIndex,
    onChange: (newSelectedIndex: number) => {
      preventLayoutShift(() =>
        addPreferredLanguage(availableLanguages[newSelectedIndex])
      )
    },
  }
}

const CodeGroupContext = createContext(null)

function useOutputReducer() {
  const [outputLines, dispatch] = useReducer(
    (
      state: string[],
      action: {
        type: 'push' | 'clear'
        payload?: string
      }
    ) => {
      switch (action.type) {
        case 'push':
          return [...state, action.payload]
        case 'clear':
          return []
      }
    },
    []
  )
  return { outputLines, dispatch }
}

export function CodeGroup({
  children,
  title,
  path,
  ...props
}: React.ComponentPropsWithoutRef<typeof CodeGroupPanels> & {
  title?: string
  path?: string // For analytics
}) {
  let hasTabs = Children.count(children) > 1
  let containerClassName =
    'not-prose my-6 overflow-hidden rounded-2xl bg-zinc-900 shadow-md dark:ring-1 dark:ring-white/10'
  let languages =
    Children.map(children, (child) =>
      getPanelTitle(isValidElement(child) ? child.props : {})
    ) ?? []
  let tabGroupProps = useTabGroupProps(languages)
  
  let header = (
    <CodeGroupHeader
      title={title}
      selectedIndex={tabGroupProps.selectedIndex}
    >
      {children}
    </CodeGroupHeader>
  )
  let panels = <CodeGroupPanels {...props}>{children}</CodeGroupPanels>

  return (
    <CodeGroupContext.Provider value={{
      path,
    }}>
      {hasTabs ? (
        <Tab.Group {...tabGroupProps} className={containerClassName}>
          {header}
          {panels}
        </Tab.Group>
      ) : (
        <div className={containerClassName}>
          {header}
          {panels}
        </div>
      )}
    </CodeGroupContext.Provider>
  )
}

export function Code({
  children,
  ...props
}: React.ComponentPropsWithoutRef<'code'>) {
  /* <DYNAMIC-API-REPLACEMENT> */
  // let apiKey = useApiKey()
  // if (children.replace && apiKey) children = children.replace(`{{API_KEY}}`, `${apiKey}`)
  /* </DYNAMIC-API-REPLACEMENT> */

  let isGrouped = !!useContext(CodeGroupContext)

  if (isGrouped) {
    if (typeof children !== 'string') {
      throw new Error(
        '`Code` children must be a string when nested inside a `CodeGroup`.'
      )
    }
    return <code {...props} dangerouslySetInnerHTML={{ __html: children }} />
  }

  return <code {...props}>{children}</code>
}

export function Pre({
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof CodeGroup>) {
  let isGrouped = useContext(CodeGroupContext)

  if (isGrouped) {
    return children
  }

  return <CodeGroup {...props}>{children}</CodeGroup>
}

/**
 * Special Component just for MDX files, processed by Remark
 */
export function CodeGroupAutoload({ children, isRunnable = true }) {
  if (!children) {
    console.warn(
      `CodeGroupAutoload: No children provided – something is wrong with your MDX file`
    )
    return null
  }
  return <CodeGroup isRunnable={isRunnable}>{children}</CodeGroup>
}
