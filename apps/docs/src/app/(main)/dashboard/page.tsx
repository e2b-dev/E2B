'use client'

import { useState } from 'react'
import { ChevronRight, CreditCard, LayoutPanelTop, LucideIcon, Package, PlusCircle, Settings, Users } from 'lucide-react'

import { GeneralContent } from '@/components/Dashboard/General'
import { BillingContent } from '@/components/Dashboard/Billing'
import { SandboxesContent } from '@/components/Dashboard/Sandboxes'
import { TeamContent } from '@/components/Dashboard/Team'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'


const menuLabels = ['General', 'Billing', 'Sandboxes', 'Team', 'Templates'] as const
type MenuLabel  = typeof menuLabels[number]

export default function Dashboard() {
  const [selectedItem, setSelectedItem] = useState<MenuLabel>('General')

  return (
    <div className="flex min-h-screen flex-row pt-32 px-32">
      <Sidebar selectedItem={selectedItem} setSelectedItem={setSelectedItem} />
      <div className="flex-1 pl-10">
        <h2 className='text-2xl mb-2 font-bold'>{selectedItem}</h2>
        <div className='border border-white/5 w-full h-[1px] mb-10'/>
        <MainContent selectedItem={selectedItem} />
      </div>
    </div>
  )
}

const Sidebar = ({ selectedItem, setSelectedItem }) => (
  <div className="h-full w-48 space-y-2">
    
    <AccountSelectItem />
    
    <MenuItem 
      icon={Settings} 
      label="General"
      selected={selectedItem === 'General'} 
      onClick={() => setSelectedItem('General')} 
    />
    <MenuItem 
      icon={CreditCard} 
      label="Billing" 
      selected={selectedItem === 'Billing'}
      onClick={() => setSelectedItem('Billing')} 
    />
    <MenuItem 
      icon={Package} 
      label="Sandboxes" 
      selected={selectedItem === 'Sandboxes'}
      onClick={() => setSelectedItem('Sandboxes')} 
    />
    <MenuItem 
      icon={Users} 
      label="Team" 
      selected={selectedItem === 'Team'}
      onClick={() => setSelectedItem('Team')} 
    />
    <MenuItem 
      icon={LayoutPanelTop} 
      label="Templates" 
      selected={selectedItem === 'Templates'} 
      onClick={() => setSelectedItem('Templates')} 
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

const AccountSelectItem = () => {
  return(
    <DropdownMenu>
    <DropdownMenuTrigger
      className='dropdown-trigger group outline-none flex w-full items-center justify-between rounded-lg p-2 mb-6 hover:bg-zinc-800 hover:cursor-pointer'
    >
      <div className='flex items-start flex-col'>
        <h3 className='font-bold'>Default Team</h3>
        <p className='text-sm'>Team account</p>
      </div> 
      <ChevronRight className='transform transition-transform duration-300 group-hover:rotate-90' />


    </DropdownMenuTrigger>
    <DropdownMenuContent className='flex flex-col w-48 bg-zinc-900 border border-white/30'>
      <DropdownMenuItem>Personal Account</DropdownMenuItem>
      <DropdownMenuSeparator/>
      <DropdownMenuItem>Default Team</DropdownMenuItem>
      <DropdownMenuItem>Other Team</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem className='flex items-center space-x-1'>
        <PlusCircle width={15} height={15} />
        <p>Create Team</p>
      </DropdownMenuItem>
    </DropdownMenuContent>
    </DropdownMenu>
  )
}

const MainContent = ({ selectedItem }: { selectedItem: MenuLabel }) => {
  switch (selectedItem) {
    case 'General':
      return <GeneralContent />
    case 'Billing':
      return <BillingContent />
    case 'Sandboxes':
      return <SandboxesContent />
    case 'Team':
      return <TeamContent />
    case 'Templates':
      return <TemplatesContent />
    default:
      return <ErrorContent />
  }
}

const TemplatesContent = () => <div>Templates Content</div>
const ErrorContent = () => <div>Error Content</div>

