'use client'

import { useEffect, useState } from 'react'
import { Button } from '../Button'
import { E2BUser, Team } from '@/utils/useUser'
import { toast } from '../ui/use-toast'
import { Copy } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../ui/alert-dialog'
import Spinner from '@/components/Spinner'

interface TeamMember {
  id: string
  email: string
}

const uuidRegex = new RegExp(
  '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
)

export const TeamContent = ({
  team,
  user,
  teams,
  setTeams,
  setCurrentTeam,
}: {
  team: Team
  user: E2BUser
  teams: Team[]
  setTeams: (teams: Team[]) => void
  setCurrentTeam: (team: Team) => void
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [teamName, setTeamName] = useState(team.name)
  const [userToAdd, setUserToAdd] = useState('')
  const [userAdded, setUserAdded] = useState(false)

  useEffect(() => {
    const getTeamMembers = async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BILLING_API_URL}/teams/${team.id}/users`,
        {
          headers: {
            'X-Team-API-Key': team.apiKeys[0],
          },
        }
      )

      if (!res.ok) {
        toast({
          title: 'An error occurred',
          description: 'We were unable to fetch the team members',
        })
        console.log(res.statusText)
        // TODO: Add sentry event here
        return
      }
      const members = (await res.json()).filter(
        (member: TeamMember) => member.id !== user.id
      )
      setMembers(members)
      setIsLoading(false)
    }

    getTeamMembers()
  }, [user, userAdded, team])

  useEffect(() => {
    setTeamName(team.name)
  }, [team])

  const closeDialog = () => setIsDialogOpen(false)
  const openDialog = (id: string) => {
    setCurrentMemberId(id)
    setIsDialogOpen(true)
  }

  const deleteUserFromTeam = async () => {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BILLING_API_URL}/teams/${team.id}/users`,
      {
        method: 'DELETE',
        headers: {
          'X-User-Access-Token': user.accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: currentMemberId }),
      }
    )

    if (!res.ok) {
      toast({
        title: 'An error occurred',
        description: 'We were unable to delete the user from the team',
      })
      console.log(res.statusText)
      // TODO: Add sentry event here
      return
    }
    setMembers(members.filter((member) => member.id !== currentMemberId))
    closeDialog()
  }

  const changeTeamName = async () => {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BILLING_API_URL}/teams/${team.id}`,
      {
        headers: {
          'X-Team-API-Key': team.apiKeys[0],
          'Content-Type': 'application/json',
        },
        method: 'PATCH',
        body: JSON.stringify({ name: teamName }),
      }
    )

    if (!res.ok) {
      toast({
        title: 'An error occurred',
        description: 'We were unable to change the team name',
      })
      console.log(res.statusText)
      return
    }

    toast({
      title: 'Team name changed',
    })
    setTeamName(teamName)
    setTeams(
      teams.map((t) => (t.id === team.id ? { ...t, name: teamName } : t))
    )
    setCurrentTeam({ ...team, name: teamName })
  }

  const addUserToTeam = async () => {
    if (!uuidRegex.test(userToAdd)) {
      toast({
        title: 'Invalid user ID',
        description: 'The user ID must be a valid UUID',
      })
      return
    }

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BILLING_API_URL}/teams/${team.id}/users`,
      {
        headers: {
          'X-User-Access-Token': user.accessToken,
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify({ user_id: userToAdd.trim() }),
      }
    )

    if (!res.ok) {
      toast({
        title: 'An error occurred',
        description: 'We were unable to add the user to the team',
      })
      console.log(res.statusText)
      return
    }

    setUserToAdd('')
    setUserAdded(!userAdded)
    toast({
      title: 'User added to team',
    })
  }

  return (
    <div className="flex flex-col justify-center pb-10">
      <h3 className="text-lg font-medium pb-4">Team name</h3>
      <div className="flex items-center space-x-2 pb-4">
        <input
          type="text"
          className="w-1/2 md:w-1/3 border border-white/10 text-sm focus:outline-none outline-none rounded-md p-2"
          placeholder={team.name}
          value={teamName}
          onChange={(e) => {
            e.preventDefault()
            setTeamName(e.target.value)
          }}
        />
        <Button variant="outline" onClick={() => changeTeamName()}>
          Save changes
        </Button>
      </div>
      <h3 className="text-lg font-medium pb-4">Team ID</h3>
      <div className="flex items-center space-x-2 pb-4">
        <input
          readOnly
          type="text"
          className="w-1/2 md:w-1/3 border border-white/10 text-sm focus:outline-none outline-none rounded-md p-2"
          value={team.id}
        />
      </div>

      <span
        className="flex pb-10 w-fit text-sm text-orange-500 hover:cursor-pointer hover:text-orange-500/30 space-x-2 items-center"
        onClick={() => {
          navigator.clipboard.writeText(team.id)
          toast({
            title: 'Team ID copied to clipboard',
          })
        }}
      >
        <p>Copy your team ID</p>
        <Copy className="h-4 w-4" />
      </span>

      <h2 className="text-xl font-bold pb-4">Add members to your team</h2>

      <div className="bg-white/5 border-l-4 border-orange-500/20 text-gray-300 p-4 mb-4" role="alert">
        <h4 className="font-medium pb-2">How to invite people to your team</h4>
        <ol className="list-decimal list-inside text-sm text-gray-400">
          <li>Have them create an E2B account</li>
          <li>Ask them to send you their user ID (Click on &quot;Copy your user ID&quot; button)</li>
          <li>Paste their user ID and click on &quot;Add user&quot;</li>
        </ol>
      </div>

      <div className="flex items-center space-x-2 pb-4">
        <input
          type="text"
          className="w-1/2 md:w-1/3 border border-white/10 text-sm focus:outline-none outline-none rounded-md p-2"
          placeholder="Paste ID of the user you want to add here"
          value={userToAdd}
          onChange={(e) => {
            e.preventDefault()
            setUserToAdd(e.target.value)
          }}
        />
        <Button variant="outline" onClick={() => addUserToTeam()}>
          Add user
        </Button>
      </div>

      <h3 className="text-lg font-medium pb-4">Your user ID</h3>
      <div className="flex items-center space-x-2 pb-4">
        <input
          readOnly
          type="text"
          className="w-1/2 md:w-1/3 border border-white/10 text-sm focus:outline-none outline-none rounded-md p-2"
          value={user.id}
        />
      </div>

      <span
        className="flex pb-4 w-fit text-sm text-orange-500 hover:cursor-pointer hover:text-orange-500/30 space-x-2 items-center"
        onClick={() => {
          navigator.clipboard.writeText(user.id)
          toast({
            title: 'User ID copied to clipboard',
          })
        }}
      >
        <p>Copy your user ID</p>
        <Copy className="h-4 w-4" />
      </span>

      <h2 className="text-xl font-bold pb-4">Team members</h2>
      {isLoading ? (
        <div className="flex items-center w-full pl-4 p-2">
          <Spinner size="24px" />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-inherit dark:hover:bg-inherit border-b border-white/5">
              <TableHead>Email</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 ? (
              <TableRow className="border-b border-white/5">
                <TableCell colSpan={2} className="text-center">
                  No members found
                </TableCell>
              </TableRow>
            ) : (
              members.map((user) => (
                <TableRow
                  className="hover:bg-orange-300/10 dark:hover:bg-orange-300/10 border-b border-white/5"
                  key={user.id}
                >
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Button
                      className="text-sm"
                      variant="desctructive"
                      onClick={() => openDialog(user.id)}
                    >
                      Remove team member
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AlertDialogTrigger asChild>
          <Button variant="outline" style={{ display: 'none' }}>
            Show Dialog
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="bg-inherit text-white border-black">
          <AlertDialogHeader>
            <AlertDialogTitle>
              You are about to delete a member from the team
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/90">
              This action cannot be undone. This will permanently delete the
              member from the team.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="border-white/10"
              onClick={closeDialog}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 text-white hover:bg-red-600"
              onClick={() => deleteUserFromTeam()}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
