'use client'

import { useEffect, useState } from 'react'
import { BarChart, CreditCard, Key, LucideIcon, Settings, Users } from 'lucide-react'

import { GeneralContent } from '@/components/Dashboard/General'
import { BillingContent } from '@/components/Dashboard/Billing'
import { TeamContent } from '@/components/Dashboard/Team'

import { useUser } from '@/utils/useUser'
import { User } from '@supabase/supabase-js'
import { KeysContent } from '@/components/Dashboard/Keys'
import { UsageContent } from '@/components/Dashboard/Usage'
import { AccountSelector } from '@/components/Dashboard/AccountSelector'
import { useRouter, useSearchParams } from 'next/navigation'


// TODO: Sandbox and Templates tab deleted for now
const menuLabels = ['general', 'keys', 'usage' ,'billing', 'team',] as const
type MenuLabel  = typeof menuLabels[number]

export default function Dashboard() {
  const { user, isLoading, error } = useUser()
  const router = useRouter()
  const searchParams = useSearchParams()

  const tab = searchParams!.get('tab')
  const initialTab = tab && menuLabels.includes(tab as MenuLabel) ? (tab as MenuLabel) : 'general'
  const [selectedItem, setSelectedItem] = useState<MenuLabel>(initialTab)

  useEffect(() => {
    if (tab !== selectedItem) {
      const params = new URLSearchParams(window.location.search)
      params.set('tab', selectedItem)
      const newUrl = `${window.location.pathname}?${params.toString()}`
      router.push(newUrl)
    }
  }, [selectedItem, tab, router])

  if (error) {
    return <div>Error: {error.message}</div>
  }
  if (isLoading) {
    return <div>Loading...</div>
  }
  if (user) {
    return (
      <div className="flex min-h-screen flex-row pt-32 px-32">
        <Sidebar selectedItem={selectedItem} setSelectedItem={setSelectedItem} user={user} />
        <div className="flex-1 pl-10">
          <h2 className='text-2xl mb-2 font-bold'>{selectedItem[0].toUpperCase() + selectedItem.slice(1)}</h2>
          <div className='border border-white/5 w-full h-[1px] mb-10'/>
          <MainContent selectedItem={selectedItem} user={user} />
        </div>
      </div>
    )
  }
}

const Sidebar = ({ selectedItem, setSelectedItem, user }) => (
  <div className="h-full w-48 space-y-2">

    <AccountSelector user={user} />

    {menuLabels.map((label) => (
      <MenuItem
        key={label.toUpperCase()}
        icon={iconMap[label]}
        label={label}
        selected={selectedItem === label}
        onClick={() => setSelectedItem(label)}
      />
    ))}
  </div>
)

const iconMap: { [key in MenuLabel]: LucideIcon } = {
  general: Settings,
  keys: Key,
  usage: BarChart,
  billing: CreditCard,
  team: Users,
}

const MenuItem = ({ icon: Icon, label , selected, onClick }: { icon: LucideIcon; label: MenuLabel; selected: boolean; onClick: () => void }) => (
  <div 
    className={`flex w-full hover:bg-orange-500/30 hover:cursor-pointer rounded-lg items-center p-2 space-x-2 ${selected ? 'bg-orange-500/30' : ''}`} 
    onClick={onClick}
  >
    <Icon width={20} height={20} />
    <p>{label[0].toUpperCase()+label.slice(1)}</p>
  </div>
)


const MainContent = ({ selectedItem, user }: { selectedItem: MenuLabel, user: User }) => {
  switch (selectedItem) {
    case 'general':
      return <GeneralContent user={user} />
    case 'keys':
      return <KeysContent user={user} />
    case 'usage':
      return <UsageContent />
    case 'billing':
      return <BillingContent />
    case 'team':
      return <TeamContent />
    default:
      return <ErrorContent />
  }
}

// TODO send sentry error from this
const ErrorContent = () => <div>Error Content</div>

