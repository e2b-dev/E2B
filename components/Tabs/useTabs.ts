import { useMemo, useState } from 'react'

type Tab = { label: string; id: string; }

export function useTabs({
  tabs,
  onChange,
}: {
  tabs: Tab[];
  onChange?: (id: string) => void
}) {
  const [selectedTabIndex, setSelectedTab] = useState(-1)

  return useMemo(() => ({
    tabProps: {
      tabs,
      selectedTabIndex,
      onChange,
      setSelectedTab,
    },
    selectedTab: tabs[selectedTabIndex],
  }), [selectedTabIndex])
}
