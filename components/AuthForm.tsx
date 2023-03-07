import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'

import Button from 'src/components/Button'
import Text from 'src/components/Text'

import SpinnerIcon from './icons/Spinner'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { useRouter } from 'next/router'

export enum AuthFormType {
  SignIn,
  SignUp,
}

export interface Props {
  authType: AuthFormType
}

function AuthForm({ authType }: Props) {
  const [isLoading, setIsLoading] = useState(false)
  const [errMessage, setErrMessage] = useState('')
  const supabaseClient = useSupabaseClient()
  const router = useRouter()

  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  useEffect(
    function autofocusEmailInput() {
      if (isLoading) return

      if (!emailRef.current?.value) {
        emailRef.current?.focus()
      } else if (!passwordRef.current?.value) {
        passwordRef.current?.focus()
      } else {
        emailRef.current?.focus()
      }
    },
    [isLoading],
  )

  async function authWithEmail() {
    setIsLoading(true)

    const email = emailRef.current?.value
    const password = passwordRef.current?.value

    if (!email) {
      setErrMessage('Email must not be empty')
      emailRef.current?.focus()
      setIsLoading(false)
      return
    }

    if (!password) {
      passwordRef.current?.focus()
      setErrMessage('Password must not be empty')
      setIsLoading(false)
      return
    }

    const { error, data: { user } } =
      authType === AuthFormType.SignUp
        ? await supabaseClient.auth.signUp({
          email,
          password,
        })
        : await supabaseClient.auth.signInWithPassword({
          email,
          password,
        })

    if (error) {
      emailRef.current?.focus()
      setErrMessage(error.message)
      console.error(error.message)
    } else {
      setErrMessage('')
    }

    router.replace('/')
    setIsLoading(false)
  }

  const title = authType === AuthFormType.SignUp ? 'Create a new account' : 'Sign in'

  const buttonLabel = authType === AuthFormType.SignUp ? 'Sign up' : 'Sign in'

  const buttonLoadingLabel =
    authType === AuthFormType.SignUp ? 'Signing up...' : 'Signing in...'

  const passwordAutocomplete =
    authType === AuthFormType.SignUp ? 'new-password' : 'current-password'

  return (
    <form
      autoComplete="on"
      onSubmit={e => {
        e.preventDefault()
        authWithEmail()
      }}
    >
      <div
        // eslint-disable-next-line tailwindcss/no-custom-classname
        className="
        flex
        max-w-120
        md:w-120

        flex-1
        flex-col
        items-center
        space-y-8
        self-start
        rounded-lg
        border
        border-slate-200
        bg-white
        py-12
        px-4
      "
      >
        <Text
          size={Text.size.S1}
          text={title}
        />
        <div className="flex w-full flex-col space-y-8 md:px-16 px-8">
          <div className="flex min-w-0 flex-col space-y-2">
            <input
              autoCapitalize="off"
              autoComplete="email"
              autoCorrect="off"
              disabled={isLoading}
              name="email"
              placeholder="Email"
              ref={emailRef}
              type="email"
              className={clsx(
                'w-full',
                'px-2.5',
                'py-2',
                'rounded-lg',
                'border',
                'border-slate-200',
                {
                  'bg-white': !isLoading,
                },
                {
                  'bg-slate-50': isLoading,
                },
                'outline-none',
                'focus:border-green-800',
                'text-sm',
                'placeholder:text-slate-300',
              )}
              required
            />
            <input
              autoComplete={passwordAutocomplete}
              autoCorrect="off"
              disabled={isLoading}
              name="password"
              placeholder="Password"
              ref={passwordRef}
              type="password"
              className={clsx(
                'px-2.5',
                'py-2',
                'rounded-lg',
                'border',
                'flex',
                'min-w-0',
                'flex-1',
                'border-slate-200',
                {
                  'bg-white': !isLoading,
                },
                {
                  'bg-slate-50': isLoading,
                },
                'outline-none',
                'focus:border-green-800',
                'text-sm',
                'placeholder:text-slate-300',
              )}
              required
            />
          </div>
          <div className="flex flex-col space-y-4">
            <Button
              className="self-center whitespace-nowrap"
              icon={isLoading ? <SpinnerIcon className="text-white" /> : null}
              isDisabled={isLoading}
              text={isLoading ? buttonLoadingLabel : buttonLabel}
              type="submit"
              variant={Button.variant.Full}
            />
            {!isLoading && !!errMessage && (
              <Text
                className="self-center text-red-500"
                size={Text.size.S3}
                text={errMessage}
              />
            )}
          </div>
        </div>
      </div>
    </form>
  )
}

AuthForm.type = AuthFormType

export default AuthForm