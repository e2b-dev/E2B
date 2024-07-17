import { FooterMain } from '@/components/Footer'
import { HeaderDashboard } from '@/components/HeaderDashboard'

export function LayoutDashboard({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="h-full w-full">
      <HeaderDashboard />

      <main className="w-full h-full flex flex-col">
        {children}
      </main>

      <FooterMain />
    </div>
  )
}


