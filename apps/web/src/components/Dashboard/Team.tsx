'use client'

import { useEffect, useState } from 'react'
import { Button } from '../Button'
import { Team } from '@/utils/useUser'
import { User, createPagesBrowserClient } from '@supabase/auth-helpers-nextjs'
import { toast } from '../ui/use-toast'
import { Copy } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog'
import Spinner from '@/components/Spinner'

interface TeamMember {
  id: string
  email: string
}

const teamUsersUrl = `${process.env.NEXT_PUBLIC_BILLING_API_URL}/teams/users`

export const TeamContent = ({ team, user, teams, currentApiKey, setTeams, setCurrentTeam }: { team: Team, user: User, teams: Team[], currentApiKey: string | null, setTeams: (teams: Team[]) => void, setCurrentTeam: (team: Team) => void }) => {
  const supabase = createPagesBrowserClient()

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [teamName, setTeamName] = useState(team.name)
  const [userToAdd, setUserToAdd] = useState('')
  const [userAdded, setUserAdded] = useState(false)

  useEffect(() => {
    const getTeamMembers = async () => {
      const res = await fetch(teamUsersUrl, {
        headers: {
          'X-Team-API-Key': currentApiKey!,
        },
      })

      if (!res.ok) {
        toast({
          title: 'An error occurred',
          description: 'We were unable to fetch the team members',
        })
        console.log(res.statusText)
        // TODO: Add sentry event here
        return
      }
      const members = (await res.json()).filter((member: TeamMember) => member.id !== user.id)
      setMembers(members)
      setIsLoading(false)
    }

    if (currentApiKey) {
      getTeamMembers()
    }
  }, [currentApiKey, user, userAdded])

  const closeDialog = () => setIsDialogOpen(false)
  const openDialog = (id: string) => {
    setCurrentMemberId(id)
    setIsDialogOpen(true)
  }

  const deleteUserFromTeam = async () => {

    const { error } = await supabase
      .from('users_teams')
      .delete()
      .eq('user_id', currentMemberId)
      .eq('team_id', team.id)

    if (error) {
      // TODO: Add sentry event here
      toast({
        title: 'An error occurred',
        description: 'We were unable to delete the member from the team',
      })
      console.log(error)
      return
    }
    setMembers(members.filter(member => member.id !== currentMemberId))
    closeDialog()
  }

  const changeTeamName = async () => {
    const { error } = await supabase
      .from('teams')
      .update({ name: teamName })
      .eq('id', team.id)

    if (error) {
      // TODO: Add sentry event here
      toast({
        title: 'An error occurred',
        description: 'We were unable to change the team name',
      })
      console.log(error)
      return
    }

    toast({
      title: 'Team name changed',
    })
    setTeamName(teamName)
    setTeams(teams.map(t => t.id === team.id ? { ...t, name: teamName } : t))
    setCurrentTeam({ ...team, name: teamName })
  }

  const addUserToTeam = async () => {
    const { error } = await supabase
      .from('users_teams')
      .insert({ user_id: userToAdd, team_id: team.id })

    if (error) {
      // TODO: Add sentry event here
      toast({
        title: 'There was an error adding the user to the team',
        description: 'Please make sure the user id is correct.',
      })
      console.log(error)
      return
    }

    setUserToAdd('')
    setUserAdded(!userAdded)
    toast({
      title: 'User added to team',
    })
  }

  return (
    <div className='flex flex-col justify-center pb-10'>
      <h2 className="text-xl font-bold pb-4">Team name</h2>
      <div className='flex items-center space-x-2 pb-6'>
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
        <Button variant='outline' onClick={() => changeTeamName()}>Save changes</Button>
      </div>

      <h2 className="text-xl font-bold pb-4">Team ID</h2>
      <p className='text-sm pb-10'>{team.id}</p>

      <h2 className="text-xl font-bold pb-4">Add new members</h2>
      <div className='flex items-center space-x-2 pb-4'>
        <input
          type="text"
          className="w-1/2 md:w-1/3 border border-white/10 text-sm focus:outline-none outline-none rounded-md p-2"
          placeholder={"Paste your other user's ID here"}
          value={userToAdd}
          onChange={(e) => {
            e.preventDefault()
            setUserToAdd(e.target.value)
          }}
        />
        <Button variant='outline' onClick={() => addUserToTeam()}>Add user</Button>
      </div>

      <span
        className='flex pb-10 w-fit text-sm text-orange-500 hover:cursor-pointer hover:text-orange-500/30 space-x-2 items-center'
        onClick={() => {
          navigator.clipboard.writeText(user.id)
          toast({
            title: 'User ID copied to clipboard',
          })
        }}
      >
        <p>Copy your user ID</p>
        <Copy className='h-4 w-4' />
      </span>

      <h2 className="text-xl font-bold pb-4">Team members</h2>
      {isLoading ? (<div className="flex items-center w-full pl-4 p-2">
        <Spinner size="24px"/>
      </div>) : (
          <Table>
            <TableHeader>
              <TableRow className='hover:bg-inherit dark:hover:bg-inherit border-b border-white/5'>
                <TableHead>Email</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length === 0 ? (
                  <TableRow className='border-b border-white/5'>
                    <TableCell colSpan={2} className='text-center'>
                      No members found
                    </TableCell>
                  </TableRow>
              ) : (
                  members.map((user) => (
                      <TableRow
                          className='hover:bg-orange-300/10 dark:hover:bg-orange-300/10 border-b border-white/5'
                          key={user.id}>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Button className='text-sm' variant='desctructive' onClick={() => openDialog(user.id)}>
                            Remove team member
                          </Button>
                        </TableCell>
                      </TableRow>
                  ))
              )}
            </TableBody>
          </Table>)}


      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AlertDialogTrigger asChild>
        <Button variant="outline" style={{ display: 'none' }}>Show Dialog</Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="bg-inherit text-white border-black">
          <AlertDialogHeader>
            <AlertDialogTitle>You are about to delete a member from the team</AlertDialogTitle>
            <AlertDialogDescription className='text-white/90'>
              This action cannot be undone. This will permanently delete the
              member from the team.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className='border-white/10' onClick={closeDialog}>Cancel</AlertDialogCancel>
            <AlertDialogAction className='bg-red-500 text-white hover:bg-red-600' onClick={() => deleteUserFromTeam()}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  )
}
