import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronRight, PlusCircle } from 'lucide-react'

export const AccountSelector = ({ user }) => { 

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
        <p className='text-sm'>Current account</p>
        <h3 className='font-bold'>{defaultTeam.name}</h3>
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