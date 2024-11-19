'use client'

import { useToast } from '../ui/use-toast'
import { Button } from '../Button'
import Link from 'next/link'
import { useState } from 'react'
import { Copy } from 'lucide-react'
import { E2BUser } from '@/utils/useUser'

const updateUserUrl = `${process.env.NEXT_PUBLIC_BILLING_API_URL}/users`

export const PersonalContent = ({ user }: { user: E2BUser }) => {
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

  const updateUserEmail = async () => {
    const res = await fetch(updateUserUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Access-Token': `Bearer ${user.accessToken}`,
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
      console.log(res.status, res.statusText)
      // TODO: Add sentry event here
      return
    }

    toast({
      title: 'Email updated',
    })
  }

  return (
    <div className="flex flex-col w-full h-full">
      <div className="flex flex-col h-full">

        <h1 className="font-bold pb-10 text-xl">
          Personal settings
        </h1>

        <span className='font-bold text-neutral-300 pb-2'>Email</span>
        <div className='flex w-full items-center space-x-2 pb-4'>
          <input
            type="text"
            className="w-1/2 border border-white/10 text-sm focus:outline-none outline-none rounded-md p-2"
            placeholder={user.email}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button variant='outline' onClick={updateUserEmail}>Save changes</Button>
        </div>

        <span className='font-bold text-neutral-300 pb-2'>User ID</span>
        <div className='flex items-center space-x-2 pb-4'>
          <input
            readOnly
            type="text"
            className="w-1/2 md:w-1/3 border border-white/10 text-sm focus:outline-none outline-none rounded-md p-2"
            value={user.id}
          />
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


        <span className='font-bold text-neutral-300 pb-2'>Access token</span>
        <span className='text-sm text-neutral-300 pb-4'>
          This is your personal access token. It is used in CLI (e.g. for building new templates).
        </span>
        <div className='flex w-full justify-between items-center border border-white/5 rounded-lg p-2 mb-4 space-x-4'>
          <div
            className="font-mono cursor-pointer text-xs md:text-sm"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={() => copyToClipboard(user.accessToken)}
          >
            {hovered ? user.accessToken : maskAccessToken(user.accessToken!)}
          </div>
        </div>

        {user.app_metadata.provider === 'email' && (
          <>
            <h1 className="font-bold pb-4 text-xl">
              Reset password
            </h1>
            <span className='text-neutral-300 pb-4'>
              Resetting will send an email with a link to reset the password. <br />
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

