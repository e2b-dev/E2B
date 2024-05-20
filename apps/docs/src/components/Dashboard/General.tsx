'use client'

import { useState } from 'react'
import { useToast } from '../ui/use-toast'
import { v4 as uuidv4 } from 'uuid'
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
import { User } from '@supabase/supabase-js'
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs'


export const GeneralContent = ({user}: {user: User}) => {
  const { toast } = useToast()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [currentKeyId, setCurrentKeyId] = useState<string | null>(null)
  const [hoveredKeyId, setHoveredKeyId] = useState<string | null>(null)

  //@ts-ignore
  const [apiKeys, setApiKeys] = useState<{ id: string, key: string, createdAt: string }[]>(user?.apiKeys.map((apiKey: any, index: any) => ({
    id: String(index + 1),
    key: apiKey.api_key,
    createdAt: apiKey.created_at,
  })) || [])

  const closeDialog = () => setIsDialogOpen(false)
  const openDialog = (id: string) => {
    setCurrentKeyId(id)
    setIsDialogOpen(true)
  }

  const deleteApiKey = () => {
    setApiKeys(apiKeys.filter(apiKey => apiKey.id !== currentKeyId))
    closeDialog()
  }

  const addApiKey = async() => {
    const supabase = createPagesBrowserClient()
    const res = await supabase
      .from('team_api_keys')
      .insert({
        team_id: user.id,
        api_key: uuidv4(),
        created_at: new Date().toISOString(),
      })
      
    console.log(res)

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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: 'API Key copied to clipboard',
    })
  }

  const maskApiKey = (key: string) => {
    const firstFour = key.slice(0, 4)
    const lastTwo = key.slice(-2)
    const stars = '*'.repeat(key.length - 6) // use fixed-width character
    return `${firstFour}${stars}${lastTwo}`
  }

  return(
  <div className="flex flex-col w-full h-full">
    <div className="flex flex-col w-fit h-full">

      <h1 className="font-bold pb-10 text-xl">
        API Keys
      </h1>
      
      <p className='text-neutral-300 pb-2'>Active keys:</p>

      {apiKeys.map((apiKey) => (
        <div 
          key={apiKey.id}
          className='flex w-full justify-between items-center border border-white/5 rounded-lg p-2 mb-4 space-x-4'
          onMouseEnter={() => setHoveredKeyId(apiKey.id)}
          onMouseLeave={() => setHoveredKeyId(null)}
          >
          <div className="font-mono text-sm">{hoveredKeyId === apiKey.id ? apiKey.key : maskApiKey(apiKey.key)}</div> {/* Use a monospace font */}
          <div className='flex items-center space-x-2'>
            <Copy className='hover:cursor-pointer' width={18} height={18} onClick={() => copyToClipboard(apiKey.key)} />
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
 
