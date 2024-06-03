import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronRight, PlusCircle } from 'lucide-react'
import { toast } from '../ui/use-toast'

export const AccountSelector = ({ teams, user, currentTeam, setCurrentTeam, setTeams }) => {

  const createNewTeam = async() => {
    const res = await fetch('/api/create-new-team', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: user.email, user_id: user.id })
    })
    if (!res.ok) {
      return
    }
    const data = await res.json()

    toast({
      title: `Team ${data.team.name} created`,
    })
    
    setTeams([...teams, data.team])
  }
  
  return(
    <DropdownMenu>
    <DropdownMenuTrigger
      className='dropdown-trigger group outline-none flex w-full items-center justify-between rounded-lg p-2 mb-6 hover:bg-zinc-800 hover:cursor-pointer'
    >
      <div className='flex items-start flex-col'>
        <p className='text-sm'>Current account</p>
        <h3 className='font-bold text-left'>{currentTeam.name}</h3>
      </div> 
      <ChevronRight className='transform transition-transform duration-300 group-hover:rotate-90' />
    </DropdownMenuTrigger>
    <DropdownMenuContent className='flex flex-col w-48 bg-zinc-900 border border-white/30'>
      {teams?.map((team: any) => (
        <DropdownMenuItem key={team.id} onClick={() => setCurrentTeam(team)}>
          {team.name}
        </DropdownMenuItem>
      ))}
      <DropdownMenuSeparator />
      <DropdownMenuItem className='flex items-center space-x-1'>
        <PlusCircle width={15} height={15} />
        <p onClick={() => createNewTeam()}>Create Team</p>
      </DropdownMenuItem>
    </DropdownMenuContent>
    </DropdownMenu>
  )
}