import { useRouter } from 'next/router'
import { useCallback } from 'react'

type Base = Record<string, string | number>

interface SetTab<T> {
  (tab: keyof T): void
}

function compareTabsCaseInsensitive<T extends Base>(tabs: T, tab?: string) {
  return Object
    .values(tabs)
    .find(v => v.toString().toLowerCase() === tab?.toLowerCase())
}

export function useQueryTab<T extends Base>(key: string, tabs: T, defaultTab: keyof T): [keyof T, SetTab<T>] {
  const router = useRouter()

  const tab = compareTabsCaseInsensitive(tabs, router.query[key] as string) as keyof T || defaultTab

  const setTab = useCallback<SetTab<T>>(tab => {
    router.push({
      pathname: router.pathname,
      query: {
        ...router.query,
        [key]: tabs[tab] as string,
      }
    }, undefined, { shallow: true })
  }, [key, router, tabs])

  return [tab, setTab]
}
