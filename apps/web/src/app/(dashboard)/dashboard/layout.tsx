import { FooterMain } from '@/components/Footer'
import { Toaster } from '@/components/ui/toaster'

export default async function Layout({ children }) {
  return (
    <div className="h-full w-full">
      <main className="w-full h-full flex flex-col">
        {children}
        <Toaster />
      </main>
      <FooterMain />
    </div>
  )
}
