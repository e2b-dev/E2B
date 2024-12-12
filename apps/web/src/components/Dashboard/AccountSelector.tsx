import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronRight, PlusCircle } from 'lucide-react'
import { toast } from '../ui/use-toast'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../ui/alert-dialog'
import { useState } from 'react'
import { Button } from '../Button'

const createTeamUrl = `${process.env.NEXT_PUBLIC_BILLING_API_URL}/teams`

export const AccountSelector = ({
  teams,
  user,
  currentTeam,
  setCurrentTeam,
  setTeams,
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [teamName, setTeamName] = useState('')
  const closeDialog = () => setIsDialogOpen(false)

  const createNewTeam = async () => {
    const res = await fetch(createTeamUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Access-Token': user.accessToken,
      },
      body: JSON.stringify({
        name: teamName,
      }),
    })
    if (!res.ok) {
      // TODO: Add sentry event here
      console.log(res.status, res.statusText)
      toast({
        title: 'An error occurred',
        description: 'We were unable to create the team',
      })
      return
    }

    const team = await res.json()

    toast({
      title: `Team ${team.name} created`,
    })

    setTeams([...teams, team])
    setCurrentTeam(team)
    setTeamName('')
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="dropdown-trigger group outline-none flex w-full items-center justify-between rounded-lg p-2 mb-6 hover:bg-zinc-800 hover:cursor-pointer">
          <div className="flex items-start flex-col">
            <p className="text-sm">Current team</p>
            <h3 className="font-bold text-left">{currentTeam.name}</h3>
          </div>
          <ChevronRight className="transform transition-transform duration-300 group-hover:rotate-90" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="flex flex-col w-48 bg-zinc-900 border border-white/30">
          {teams?.map((team: any) => (
            <DropdownMenuItem
              key={team.id}
              onClick={() => setCurrentTeam(team)}
            >
              {team.name}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="flex items-center space-x-1"
            onClick={() => setIsDialogOpen(true)}
          >
            <PlusCircle width={15} height={15} />
            <span>Create Team</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AlertDialogTrigger asChild>
          <Button variant="outline" style={{ display: 'none' }}>
            Show Dialog
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="bg-inherit text-white border-black">
          <AlertDialogHeader>
            <AlertDialogTitle>Give your team a name</AlertDialogTitle>
            <input
              className="border border-white/10 text-sm focus:outline-none outline-none rounded-md p-2"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
            />
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="border-white/10"
              onClick={closeDialog}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#995100] text-white hover:bg-[#995100]"
              onClick={() => createNewTeam()}
            >
              Create
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
