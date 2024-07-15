'use client'

import { useToast } from '../ui/use-toast'
import { Button } from '../Button'
import { User } from '@supabase/supabase-js'
import Link from 'next/link'
import { useState } from 'react'


const updateUserUrl = `${process.env.NEXT_PUBLIC_BILLING_API_URL}/users`

export const PersonalContent = ({user, accessToken}: {user: User, accessToken: string | null}) => {
  const { toast } = useToast()
  const [email, setEmail] = useState(user.email)

  const updateUserEmail = async() => {
    if (!accessToken) {
      return
    }

    const res = await fetch(updateUserUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Access-Token': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
            email,
          }
      )
    })

    if (!res.ok) {
      toast({
        title: 'An error occurred',
        description: 'We were unable to update the email',
      })
      return
    }

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
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button variant='outline' onClick={updateUserEmail}>Save changes</Button>
      </div>
      
      {user.app_metadata.provider === 'email' && (
        <>
        <h1 className="font-bold pb-4 text-xl">
            Reset password
          </h1>
          <span className='text-neutral-300 pb-4'>
            Resetting will send an email with a link to reset the password. <br/>
          </span>
          <div className='flex items-center space-x-2 pb-10'>
            <Link href={'/sign-in?view=forgotten-password'}>
              <Button variant='desctructive'>
                Reset password
              </Button>
            </Link>
          </div>
        </>
      )}

      </div>
    </div>
  )
}
 
