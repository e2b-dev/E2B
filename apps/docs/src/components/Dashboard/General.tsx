'use client'

import { useState } from 'react'
import { useToast } from '../ui/use-toast'
import uuidv4 from 'uuid'
import { Copy, Delete } from 'lucide-react'
import { Button } from '../Button'

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

const fakeApiKeys = [
  {
    id: '1',
    key: '3728621b-10ca-4153-99f5-e8b7080117f7',
    createdAt: '2022-10-04T04:45:00.000Z',
    updatedAt: '2022-10-04T04:45:00.000Z',
  },
  {
    id: '2',
    key: '16eea788-3927-4501-b5c5-b3eeb170bc38',
    createdAt: '2022-10-04T04:45:00.000Z',
    updatedAt: '2022-10-04T04:45:00.000Z',
  },
]

export const GeneralContent = () => {
  const { toast } = useToast()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [apiKeys, setApiKeys] = useState(fakeApiKeys)
  const [currentKeyId, setCurrentKeyId] = useState<string | null>(null)

  const closeDialog = () => setIsDialogOpen(false)
  const openDialog = (id: string) => {
    setCurrentKeyId(id)
    setIsDialogOpen(true)
  }

  const deleteApiKey = () => {
    setApiKeys(apiKeys.filter(apiKey => apiKey.id !== currentKeyId))
    closeDialog()
  }

  const addApiKey = () => {
    
    toast({
      title: 'API key created',
    })
    
    const newKey = {
      id: uuidv4(), 
      key: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setApiKeys([...apiKeys, newKey])
  }
  return(
  <div className="flex flex-col w-full h-full">
    <div className="flex flex-col w-fit h-full">

      <h1 className="font-bold pb-10 text-xl">
        API Keys
      </h1>
      
      <p className='text-neutral-300 pb-2'>Active keys:</p>

      {apiKeys.map((apiKey) => (
        <div key={apiKey.id} className='flex w-full justify-between items-center border border-white/5 rounded-lg p-2 mb-4 space-x-4'>
          <div>{apiKey.key}</div>
          <div className='flex items-center space-x-2'>
            <Copy className='hover:cursor-pointer' width={18} height={18} />
            <Delete className='hover:cursor-pointer' color='red' width={20} height={20} onClick={() => openDialog(apiKey.id)} />
          </div>
        </div>
      ))}

      <Button className='w-fit' onClick={addApiKey}>Add API Key</Button>
      
      </div>

      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AlertDialogTrigger asChild>
          <Button variant="outline" style={{ display: 'none' }}>Show Dialog</Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="bg-inherit text-white border-black">
          <AlertDialogHeader>
            <AlertDialogTitle>You are about to delete an API key</AlertDialogTitle>
            <AlertDialogDescription className='text-white/90'>
              This action cannot be undone. This will permanently delete the
              API key with immediate effect.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className='border-white/10' onClick={closeDialog}>Cancel</AlertDialogCancel>
            <AlertDialogAction className='bg-red-500 text-white hover:bg-red-600' onClick={deleteApiKey}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    
    </div>
  )
}
 
