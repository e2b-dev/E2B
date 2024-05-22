'use client'

import { useState } from 'react'
import { ChevronRight, CreditCard, Key, LucideIcon, PlusCircle, Settings, Users } from 'lucide-react'

import { GeneralContent } from '@/components/Dashboard/General'
import { BillingContent } from '@/components/Dashboard/Billing'
import { TeamContent } from '@/components/Dashboard/Team'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useUser } from '@/utils/useUser'
import { User } from '@supabase/supabase-js'
import { KeysContent } from '@/components/Dashboard/Keys'


// TODO: Sandbox and Templates tab deleted for now
const menuLabels = ['General', 'Keys' ,'Billing', 'Team',] as const
type MenuLabel  = typeof menuLabels[number]

export default function Dashboard() {
  const { user, isLoading, error } = useUser()
  const [selectedItem, setSelectedItem] = useState<MenuLabel>('General')

  if (error)  {
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
          <h2 className='text-2xl mb-2 font-bold'>{selectedItem}</h2>
          <div className='border border-white/5 w-full h-[1px] mb-10'/>
          <MainContent selectedItem={selectedItem} user={user} />
        </div>
      </div>
    )
  }
}

const Sidebar = ({ selectedItem, setSelectedItem, user }) => (
  <div className="h-full w-48 space-y-2">
    
    <AccountSelectItem user={user} />
    
    <MenuItem 
      icon={Settings} 
      label="General"
      selected={selectedItem === 'General'} 
      onClick={() => setSelectedItem('General')} 
    />
    <MenuItem 
      icon={Key} 
      label="Keys" 
      selected={selectedItem === 'Keys'}
      onClick={() => setSelectedItem('Keys')} 
    />
    <MenuItem 
      icon={CreditCard} 
      label="Billing" 
      selected={selectedItem === 'Billing'}
      onClick={() => setSelectedItem('Billing')} 
    />
    <MenuItem 
      icon={Users} 
      label="Team" 
      selected={selectedItem === 'Team'}
      onClick={() => setSelectedItem('Team')} 
    />
  </div>
)

const MenuItem = ({ icon: Icon, label , selected, onClick }: { icon: LucideIcon; label: MenuLabel; selected: boolean; onClick: () => void }) => (
  <div 
    className={`flex w-full hover:bg-orange-500/30 hover:cursor-pointer rounded-lg items-center p-2 space-x-2 ${selected ? 'bg-orange-500/30' : ''}`} 
    onClick={onClick}
  >
    <Icon width={20} height={20} />
    <p>{label}</p>
  </div>
)

const AccountSelectItem = ({ user }) => { 

  const teams = user?.teams.map((team: any) => ({
    id: team.id,
    name: team.name,
    default: team.is_default,
  }))

  const defaultTeam = teams?.find((teams: any) => teams.default)

  return(
    <DropdownMenu>
    <DropdownMenuTrigger
      className='dropdown-trigger group outline-none flex w-full items-center justify-between rounded-lg p-2 mb-6 hover:bg-zinc-800 hover:cursor-pointer'
    >
      <div className='flex items-start flex-col'>
        <h3 className='font-bold'>{defaultTeam.name}</h3>
        {/* <p className='text-sm'>Team account</p> */}
      </div> 
      <ChevronRight className='transform transition-transform duration-300 group-hover:rotate-90' />
    </DropdownMenuTrigger>
    <DropdownMenuContent className='flex flex-col w-48 bg-zinc-900 border border-white/30'>
      {teams?.map((team: any) => (
        <DropdownMenuItem key={team.id}>
          {team.name}
        </DropdownMenuItem>
      ))}
      <DropdownMenuSeparator />
      <DropdownMenuItem className='flex items-center space-x-1'>
        <PlusCircle width={15} height={15} />
        <p>Create Team</p>
      </DropdownMenuItem>
    </DropdownMenuContent>
    </DropdownMenu>
  )
}

const MainContent = ({ selectedItem, user }: { selectedItem: MenuLabel, user: User }) => {
  switch (selectedItem) {
    case 'General':
      return <GeneralContent user={user} />
    case 'Keys':
      return <KeysContent user={user} />
    case 'Billing':
      return <BillingContent />
    case 'Team':
      return <TeamContent />
    default:
      return <ErrorContent />
  }
}

const ErrorContent = () => <div>Error Content</div>

