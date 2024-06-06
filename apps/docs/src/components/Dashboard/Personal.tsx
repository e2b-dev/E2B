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

  const resetPassword = async() => {
    const supabase = createPagesBrowserClient()
    await supabase.auth.resetPasswordForEmail('hello@example.com', {
      redirectTo: 'http://example.com/account/update-password',
    })
  }

  console.log(user.app_metadata.provider)

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
      
      {user.app_metadata.provider === 'email' && (
        <>
        <h1 className="font-bold pb-4 text-xl">
            Reset password
          </h1>
          <span className='text-neutral-300 pb-4'>
            Resetting the will send an email with a link to reset the password. <br/>
            The action cannot be undone.
          </span>
          <div className='flex items-center space-x-2 pb-10'>
            <Button variant='desctructive' onClick={resetPassword}>Reset password</Button>
          </div>
        </>
      )}

      </div>
    </div>
  )
}
 
