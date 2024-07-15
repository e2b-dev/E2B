'use client'

import { useToast } from '../ui/use-toast'
import { Button } from '../Button'
import { User } from '@supabase/supabase-js'
import Link from 'next/link'
import { useState } from 'react'
import {Copy} from "lucide-react";


const updateUserUrl = `${process.env.NEXT_PUBLIC_BILLING_API_URL}/users`

export const PersonalContent = ({user, accessToken}: {user: User, accessToken: string}) => {
  const { toast } = useToast()
  const [hovered, setHovered] = useState<boolean>(false)
  const [email, setEmail] = useState(user.email)

  const maskAccessToken = (key: string) => {
    const firstSeven = key.slice(0, 7)
    const lastFour = key.slice(-4)
    const stars = '*'.repeat(key.length - 11) // use fixed-width character
    return `${firstSeven}${stars}${lastFour}`
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: 'Access token copied to clipboard',
    })
  }

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

      <span className='font-bold text-neutral-300 pb-2'>Email:</span>
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


      <span className='font-bold text-neutral-300 pb-2'>Access token:</span>
      <span className='text-sm text-neutral-300 pb-4'>
        This is your personal access token. It is used in CLI (e.g. for building new templates). You may need it for GitHub Actions or other CI/CD tools.
      </span>
      <div className='flex w-full justify-between items-center border border-white/5 rounded-lg p-2 mb-4 space-x-4'>
        <div
            className="font-mono cursor-pointer text-xs md:text-sm"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={() => copyToClipboard(accessToken)}
        >
          {hovered ? accessToken : maskAccessToken(accessToken!)}
        </div>
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
 
