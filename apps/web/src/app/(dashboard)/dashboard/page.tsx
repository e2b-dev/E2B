'use client'

import { Suspense, useEffect, useState } from 'react'
import { useLocalStorage } from 'usehooks-ts'

import {
  ArrowUpRight,
  BarChart,
  CreditCard,
  FileText,
  Key,
  LucideIcon,
  PackageIcon,
  PencilRuler,
  Settings,
  Users,
} from 'lucide-react'

import { BillingContent } from '@/components/Dashboard/Billing'
import { TeamContent } from '@/components/Dashboard/Team'

import { E2BUser, Team, useUser } from '@/utils/useUser'
import { KeysContent } from '@/components/Dashboard/Keys'
import { UsageContent } from '@/components/Dashboard/Usage'
import { AccountSelector } from '@/components/Dashboard/AccountSelector'
import { useRouter, useSearchParams } from 'next/navigation'
import { PersonalContent } from '@/components/Dashboard/Personal'
import { TemplatesContent } from '@/components/Dashboard/Templates'
import { SandboxesContent } from '@/components/Dashboard/Sandboxes'
import { DeveloperContent } from '@/components/Dashboard/Developer'
import { Button } from '@/components/Button'

function redirectToCurrentURL() {
  const url = typeof window !== 'undefined' ? window.location.href : undefined

  if (!url) {
    return ''
  }

  const encodedURL = encodeURIComponent(url)
  return `redirect_to=${encodedURL}`
}

const menuLabels = [
  'personal',
  'keys',
  'sandboxes',
  'templates',
  'usage',
  'billing',
  'team',
  'developer',
] as const
type MenuLabel = (typeof menuLabels)[number]

export default function Page() {
  const { user, isLoading, error } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) {
      return
    }
    if (!user) {
      router.push(`/auth/sign-in?${redirectToCurrentURL()}`)
    }
  }, [isLoading, user, router])

  if (error) {
    return <div>Error: {error.message}</div>
  }

  if (user) {
    return (
      <div className="flex flex-col md:flex-row pt-16 md:pt-32 px-2 md:px-32">
        <Suspense>
          <Dashboard user={user} />
        </Suspense>
      </div>
    )
  }
}

const Dashboard = ({ user }) => {
  const searchParams = useSearchParams()

  const tab = searchParams!.get('tab')
  const teamParam = searchParams!.get('team')
  const [teams, setTeams] = useState<Team[]>([])
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null)

  const domainState = useLocalStorage(
    'e2bDomain',
    process.env.NEXT_PUBLIC_DOMAIN || ''
  )

  const initialTab =
    tab && menuLabels.includes(tab as MenuLabel)
      ? (tab as MenuLabel)
      : 'personal'
  const [selectedItem, setSelectedItem] = useState<MenuLabel>(initialTab)

  const router = useRouter()

  useEffect(() => {
    if (user) {
      if (teamParam) {
        const team = user.teams.find((team: Team) => team.id === teamParam)
        if (team) {
          setCurrentTeam(team)
          setTeams(user.teams)
        }
      } else {
        const defaultTeam = user.teams.find((team: Team) => team.is_default)
        setCurrentTeam(defaultTeam || user.teams[0]) // seems like a sensible default
        setTeams(user.teams)
      }
    }
  }, [user, teamParam, setCurrentTeam, setTeams])

  useEffect(() => {
    if (tab !== selectedItem) {
      const params = new URLSearchParams(window.location.search)
      params.set('tab', selectedItem)
      const newUrl = `${window.location.pathname}?${params.toString()}`
      router.push(newUrl)
    }
  }, [selectedItem, tab, router])

  useEffect(() => {
    if (currentTeam && teamParam !== currentTeam?.id) {
      const params = new URLSearchParams(window.location.search)
      if (currentTeam) {
        params.set('team', currentTeam.id)
      } else {
        params.delete('team')
      }
      const newUrl = `${window.location.pathname}?${params.toString()}`
      router.push(newUrl)
    }
  }, [currentTeam, teamParam, router])

  if (currentTeam) {
    return (
      <>
        <Sidebar
          selectedItem={selectedItem}
          setSelectedItem={setSelectedItem}
          teams={teams}
          user={user}
          currentTeam={currentTeam}
          setCurrentTeam={setCurrentTeam}
          setTeams={setTeams}
          domainState={domainState}
        />
        <div className="flex-1 md:pl-10 pb-16">
          <div className="flex flex-col  w-full">
            <h2 className="text-2xl mb-2 font-bold">
              {selectedItem[0].toUpperCase() + selectedItem.slice(1)}
            </h2>
            {currentTeam.is_blocked && (
              <Button
                onClick={() => setSelectedItem('usage')}
                variant="desctructive"
                className="mb-3 dark:ring-0 w-fit dark:bg-red-900/20 whitespace-break-spaces rounded-lg h-8 items-center text-xs"
              >
                Usage is blocked: {currentTeam.blocked_reason}.
                <ArrowUpRight className="w-4 h-4" />
              </Button>
            )}
          </div>

          <div className="border border-white/5 w-full h-[1px] mb-10" />
          <MainContent
            selectedItem={selectedItem}
            user={user}
            team={currentTeam}
            teams={teams}
            setTeams={setTeams}
            setCurrentTeam={setCurrentTeam}
            domainState={domainState}
          />
        </div>
      </>
    )
  }
}

const Sidebar = ({
  selectedItem,
  setSelectedItem,
  teams,
  user,
  currentTeam,
  setCurrentTeam,
  setTeams,
  domainState,
}) => (
  <div className="md:h-full md:w-48 space-y-2 pb-10 md:pb-0">
    <AccountSelector
      teams={teams}
      user={user}
      currentTeam={currentTeam}
      setCurrentTeam={setCurrentTeam}
      setTeams={setTeams}
      domainState={domainState}
    />

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
  templates: FileText,
  sandboxes: PackageIcon,
  developer: PencilRuler,
}

const MenuItem = ({
  icon: Icon,
  label,
  selected,
  onClick,
}: {
  icon: LucideIcon
  label: MenuLabel
  selected: boolean
  onClick: () => void
}) => (
  <div
    className={`flex w-fit md:w-full hover:bg-[#995100]  hover:cursor-pointer rounded-lg items-center p-2 space-x-2 ${
      selected ? 'bg-[#995100]' : ''
    }`}
    onClick={onClick}
  >
    <Icon width={20} height={20} />
    <p
      className={`${
        !label || !window.matchMedia('(min-width: 768)').matches
          ? 'sr-only sm:not-sr-only'
          : ''
      }`}
    >
      {label[0].toUpperCase() + label.slice(1)}
    </p>
  </div>
)

function MainContent({
  selectedItem,
  user,
  team,
  teams,
  setTeams,
  setCurrentTeam,
  domainState,
}: {
  selectedItem: MenuLabel
  user: E2BUser
  team: Team
  teams: Team[]
  setTeams: (teams: Team[]) => void
  setCurrentTeam: (team: Team) => void
  domainState: [string, (value: string) => void]
}) {
  switch (selectedItem) {
    case 'personal':
      return <PersonalContent user={user} domain={domainState[0]} />
    case 'keys':
      return (
        <KeysContent currentTeam={team} user={user} domain={domainState[0]} />
      )
    case 'sandboxes':
      return <SandboxesContent team={team} domain={domainState[0]} />
    case 'templates':
      return (
        <TemplatesContent
          user={user}
          teamId={team.id}
          domain={domainState[0]}
        />
      )
    case 'usage':
      return <UsageContent team={team} domain={domainState[0]} />
    case 'billing':
      return <BillingContent team={team} domain={domainState[0]} />
    case 'team':
      return (
        <TeamContent
          team={team}
          user={user}
          teams={teams}
          setTeams={setTeams}
          setCurrentTeam={setCurrentTeam}
          domain={domainState[0]}
        />
      )
    case 'developer':
      return <DeveloperContent domainState={domainState} />
    default:
      return <ErrorContent />
  }
}

// TODO send sentry error from this
const ErrorContent = () => <div>Error Content</div>
