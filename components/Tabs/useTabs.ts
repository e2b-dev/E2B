import { useMemo, useState } from 'react'

type Tab = { label: string; id: string; }

export function useTabs({
  tabs,
}: {
  tabs: Tab[];
}) {
  const [selectedTabIndex, setSelectedTab] = useState(-1)

  return useMemo(() => ({
    tabProps: {
      tabs,
      selectedTabIndex,
      setSelectedTab,
    },
    selectedTab: tabs[selectedTabIndex],
  }), [selectedTabIndex, tabs])
}
