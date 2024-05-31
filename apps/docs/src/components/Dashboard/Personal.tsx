'use client'

import { useToast } from '../ui/use-toast'
import { Button } from '../Button'
import { User } from '@supabase/supabase-js'
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs'


export const PersonalContent = ({user}: {user: User}) => {
  const { toast } = useToast()

  const updateUserEmail = async() => {
    const supabase = createPagesBrowserClient()
    const res = await supabase
      .from('users')
      .update({
        email: user.email,
      })
      
    console.log(res)

    toast({
      title: 'Email updated',
    })
  }

  return(
  <div className="flex flex-col w-full h-full">
    <div className="flex flex-col h-full">

      <h1 className="font-bold pb-10 text-xl">
        Personal settings
      </h1>
      <span className='text-neutral-300 pb-2'>Email:</span>
      <div className='flex w-full items-center space-x-2 pb-10'>
        <input
          type="text"
          className="w-1/2 border border-white/10 text-sm focus:outline-none outline-none rounded-md p-2"
          placeholder={user.email}
          value={user.email}
          onSubmit={updateUserEmail}
        />
        <Button variant='outline'>Save changes</Button>
      </div>

      <span className='text-neutral-300 pb-2'>Change password:</span>
      <div className='flex items-center space-x-2 pb-10'>
        <input
          type="text"
          className="w-1/2 border border-white/10 text-sm focus:outline-none outline-none rounded-md p-2"
          placeholder={user.email}
          value={user.email}
          onSubmit={updateUserEmail}
        />
        <Button variant='outline'>Change password</Button>
      </div>
      </div>
    </div>
  )
}
 
