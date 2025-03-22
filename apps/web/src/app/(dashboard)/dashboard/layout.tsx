import { FooterMain } from '@/components/Footer'
import { Toaster } from '@/components/ui/toaster'
import { type ReactNode } from 'react'

type Props = { children?: ReactNode }

export default async function Layout({ children }: Props) {
  return (
    <div className="h-full w-full flex flex-col">
      <main className="w-full flex flex-col flex-1">
        {children}
        <Toaster />
      </main>
      <FooterMain />
    </div>
  )
}
