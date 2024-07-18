import { FooterMain } from '@/components/Footer'

export function LayoutDashboard({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="h-full w-full">
      <main className="w-full h-full flex flex-col">
        {children}
      </main>
      <FooterMain />
    </div>
  )
}


