import { FooterMain } from '@/components/Footer'
import { Toaster } from '@/components/ui/toaster'

export default async function Layout({ children }) {
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
