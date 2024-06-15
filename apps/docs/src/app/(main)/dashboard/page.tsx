'use client'

import { useEffect, useState } from 'react'
import { BarChart, CreditCard, Key, LoaderIcon, LucideIcon, Settings, Users } from 'lucide-react'

import { BillingContent } from '@/components/Dashboard/Billing'
import { TeamContent } from '@/components/Dashboard/Team'

import { Team, useUser } from '@/utils/useUser'
import { User } from '@supabase/supabase-js'
import { KeysContent } from '@/components/Dashboard/Keys'
import { UsageContent } from '@/components/Dashboard/Usage'
import { AccountSelector } from '@/components/Dashboard/AccountSelector'
import { useRouter, useSearchParams } from 'next/navigation'
import { PersonalContent } from '@/components/Dashboard/Personal'
import Link from 'next/link'
import { Button } from '@/components/Button'

function redirectToCurrentURL() {
  const url = typeof window !== 'undefined' ? window.location.href : undefined

  if (!url) {
    return ''
  }

  const encodedURL = encodeURIComponent(url)
  return `redirect_to=${encodedURL}`
}

// TODO: Sandbox and Templates tab deleted for now
const menuLabels = ['personal', 'keys', 'usage' ,'billing', 'team',] as const
type MenuLabel  = typeof menuLabels[number]

export default function Dashboard() {
  const { user, isLoading, error } = useUser()
  const router = useRouter()
  const searchParams = useSearchParams()

  const tab = searchParams!.get('tab')
  const initialTab = tab && menuLabels.includes(tab as MenuLabel) ? (tab as MenuLabel) : 'personal'
  const [selectedItem, setSelectedItem] = useState<MenuLabel>(initialTab)
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null)
  const [currentApiKey, setCurrentApiKey] = useState<string | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  
  useEffect(() => {
    if (user) {
      setCurrentTeam(user.teams[0]) // seems like a sensible default
      setTeams(user.teams)
    }
  }, [user])

  useEffect(() => {
    if (user && currentTeam) {
      const apiKey = user.apiKeys.find(key => key.team_id === currentTeam?.id)
      setCurrentApiKey(apiKey?.api_key)
    }
  }, [currentApiKey, currentTeam, user])

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
    return (
      <div className='flex flex-col space-y-2 items-center justify-center w-full h-full'>
        <div className="text-xl font-bold">Loading...</div>
        <LoaderIcon className="animate-spin" />
      </div>
    )
  }
  if (user && currentTeam) {
    return (
      <div className="flex min-h-screen flex-col md:flex-row pt-16 md:pt-32 px-2 md:px-32">
        <Sidebar selectedItem={selectedItem} setSelectedItem={setSelectedItem} teams={teams} user={user} currentTeam={currentTeam} setCurrentTeam={setCurrentTeam} setTeams={setTeams} />
        <div className="flex-1 md:pl-10">
          <h2 className='text-2xl mb-2 font-bold'>{selectedItem[0].toUpperCase() + selectedItem.slice(1)}</h2>
          <div className='border border-white/5 w-full h-[1px] mb-10'/>
          <MainContent selectedItem={selectedItem} user={user} team={currentTeam} currentApiKey={currentApiKey} />
        </div>
      </div>
    )
  } else {
    return (
      <div className='flex flex-col space-y-2 items-center justify-center w-full h-full'>
        <h2 className='text-xl font-bold'>You need to be signed in to use this page</h2>
        <Link href={`/sign-in?${redirectToCurrentURL()}`}>
          <Button>Sign In</Button>
        </Link>
      </div>
    )
  }
}

const Sidebar = ({ selectedItem, setSelectedItem, teams, user ,currentTeam, setCurrentTeam, setTeams }) => (
  <div className="md:h-full md:w-48 space-y-2 pb-10 md:pb-0">

    <AccountSelector teams={teams} user={user} currentTeam={currentTeam} setCurrentTeam={setCurrentTeam} setTeams={setTeams} />

    <div className="flex flex-row justify-center space-x-4 md:space-x-0 md:space-y-2 md:flex-col">
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

  </div>
)

const iconMap: { [key in MenuLabel]: LucideIcon } = {
  personal: Settings,
  keys: Key,
  usage: BarChart,
  billing: CreditCard,
  team: Users,
}

const MenuItem = ({ icon: Icon, label , selected, onClick }: { icon: LucideIcon; label: MenuLabel; selected: boolean; onClick: () => void }) => (
  <div 
    className={`flex w-fit md:w-full hover:bg-orange-500/30 hover:cursor-pointer rounded-lg items-center p-2 space-x-2 ${selected ? 'bg-orange-500/30' : ''}`} 
    onClick={onClick}
  >
    <Icon width={20} height={20} />
    <p className={`${!label || !window.matchMedia('(min-width: 768)').matches ? 'sr-only sm:not-sr-only' : ''}`}>
      {label[0].toUpperCase()+label.slice(1)}
    </p>
  </div>
)


const MainContent = ({ selectedItem, user, team, currentApiKey }: { selectedItem: MenuLabel, user: User, team: Team, currentApiKey: string | null}) => {
  switch (selectedItem) {
    case 'personal':
      return <PersonalContent user={user} />
    case 'keys':
      return <KeysContent user={user} currentTeam={team} currentApiKey={currentApiKey} />
    case 'usage':
      return <UsageContent currentApiKey={currentApiKey} />
    case 'billing':
      return <BillingContent currentApiKey={currentApiKey} />
    case 'team':
      return <TeamContent team={team} user={user} />
    default:
      return <ErrorContent />
  }
}

// TODO send sentry error from this
const ErrorContent = () => <div>Error Content</div>

