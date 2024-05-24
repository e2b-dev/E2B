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
import { Copy, Delete } from 'lucide-react'
import { useState } from 'react'
import { useToast } from '../ui/use-toast'
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs'
import { User } from '@supabase/supabase-js'


export const KeysContent = ({user}: {user: User}) => {
  const supabase = createPagesBrowserClient()

  const { toast } = useToast()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [currentKey, setCurrentKey] = useState<string | null>(null)
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)

  //@ts-ignore
  const [apiKeys, setApiKeys] = useState<{ key: string, createdAt: string }[]>(user?.apiKeys.map((apiKey: any) => ({
    key: apiKey.api_key,
    createdAt: apiKey.created_at,
  })) || [])

  const closeDialog = () => setIsDialogOpen(false)
  const openDialog = (key: string) => {
    setCurrentKey(key)
    setIsDialogOpen(true)
  }

  const deleteApiKey = async() => {
    
    const { error } = await supabase
      .from('team_api_keys')
      .delete()
      .eq('api_key', currentKey)

    if (error) {
      // TODO: Add sentry event here
      console.log(error)
      return
    }
    
    setApiKeys(apiKeys.filter(apiKey => apiKey.key !== currentKey))
    closeDialog()
  }

  const addApiKey = async() => {

    // TODO, make team selection real
    //@ts-ignore
    const teamId = user?.teams[0].id as string

    const res = await fetch('/api/create-api-key', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ teamId }),
    })
    if (!res.ok) {
      return
    } 

    const newKey = await res.json()

    toast({
      title: 'API key created',
    })
    
    setApiKeys([...apiKeys, {key: newKey.api_key, createdAt: newKey.created_at}])
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

  return (
    <div className="flex flex-col w-full h-full">
    <div className="flex flex-col w-fit h-full">
    
    <div className='flex flex-col w-full pb-10'>
      <Button className='w-fit' onClick={addApiKey}>Add API Key</Button>
    </div>
    
    <p className='text-neutral-300 pb-2'>Active keys:</p>

    {apiKeys.map((apiKey, index) => (
    <div 
      key={index}
      className='flex w-full justify-between items-center border border-white/5 rounded-lg p-2 mb-4 space-x-4'
      onMouseEnter={() => setHoveredKey(apiKey.key)}
      onMouseLeave={() => setHoveredKey(null)}
      >
      <div className="font-mono text-sm">{hoveredKey === apiKey.key ? apiKey.key : maskApiKey(apiKey.key)}</div> {/* Use a monospace font */}
      <div className='flex items-center space-x-2'>
        <Copy className='hover:cursor-pointer' width={18} height={18} onClick={() => copyToClipboard(apiKey.key)} />
        <Delete className='hover:cursor-pointer' color='red' width={20} height={20} onClick={() => openDialog(apiKey.key)} />
      </div>
    </div>
    ))}
    
    
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