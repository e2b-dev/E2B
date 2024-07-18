'use client'

import AuthForm from '@/components/AuthForm'
import { Suspense } from 'react'

export default function SignUp() {
  return (
    <Suspense>
      <AuthForm view="sign_up" />
    </Suspense>
  )
}
