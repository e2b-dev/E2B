'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

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
} from '@/components/ui/alert-dialog'

import { useState } from 'react'
import { Delete } from 'lucide-react'
import { Button } from '../Button'

const fakeTeam = { 
  id: '1',
  name: 'Default Team',
  users: [{ id: '1', name: 'User1', role: 'admin' }, { id: '2', name: 'User2', role: 'user' }]
}

export const TeamContent = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [currentKeyId, setCurrentUserId] = useState<string | null>(null)
  const [team, setTeam] = useState(fakeTeam)

  const closeDialog = () => setIsDialogOpen(false) 
  const openDialog = (id: string) => {
    setCurrentUserId(id)
    setIsDialogOpen(true)
  } 
  
  const deleteUserFromTeam = () => {
    // setApiKeys(apiKeys.filter(apiKey => apiKey.id !== currentKeyId))
    closeDialog()
  } 
  
  return (
    <div className='flex flex-col justify-center'>
      <h2 className="text-xl font-bold pb-4">Team name</h2>
      <div className='flex items-center space-x-2 pb-10'>
        <input
          type="text"
          className="w-1/3 border border-white/10 text-sm focus:outline-none outline-none rounded-md p-2"
          placeholder={team.name}
          value={team.name}
          onChange={(e) => setTeam({ ...team, name: e.target.value })}
        />
        <Button variant='outline'>Save changes</Button>
      </div>

      <h2 className="text-xl font-bold pb-4">Team members</h2>
      <Table>
      <TableHeader>
      <TableRow className='hover:bg-orange-500/10 dark:hover:bg-orange-500/10 border-b border-white/5 '>
        <TableHead>Name</TableHead>
        <TableHead>Role</TableHead>
        <TableHead></TableHead>
      </TableRow>
      </TableHeader>
      <TableBody>
      {team.users.map((user) => (
        <TableRow 
        className='hover:bg-orange-300/10 dark:hover:bg-orange-300/10 border-b border-white/5'
        key={user.id}>
          <TableCell>{user.name}</TableCell>
          <TableCell>{user.role}</TableCell>
          <TableCell>
            <Delete className='hover:cursor-pointer' color='red' width={20} height={20} onClick={() => openDialog(user.id)} />
          </TableCell>
        </TableRow>
        ))}
      </TableBody>
      </Table>

      <h2 className="text-xl font-bold pt-10 pb-4">Invite new members</h2>

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
            <AlertDialogAction className='bg-red-500 text-white hover:bg-red-600' onClick={deleteUserFromTeam}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  )
}