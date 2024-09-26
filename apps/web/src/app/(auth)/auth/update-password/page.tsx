'use client'

import AuthForm from '@/components/AuthForm'
import { Suspense } from 'react'

export default function UpdatePassword() {
  return (
    <Suspense>
      <AuthForm view="update_password" />
    </Suspense>
  )
}
