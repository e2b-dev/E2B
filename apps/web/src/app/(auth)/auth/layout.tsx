import { Footer } from '@/components/Footer'
import { type ReactNode } from 'react'

type Props = { children?: ReactNode }

export default async function Layout({ children }: Props) {
  return (
    <div className="pt-12">
      {children}
      <Footer />
    </div>
  )
}
