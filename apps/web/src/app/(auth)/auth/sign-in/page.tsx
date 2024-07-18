'use client'

import AuthForm from '@/components/AuthForm'
import { Suspense } from 'react'

export default function Sign() {
  return (
    <Suspense>
      <AuthForm view="sign_in" />
    </Suspense>
  )
}
