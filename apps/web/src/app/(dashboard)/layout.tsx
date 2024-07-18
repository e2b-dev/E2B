import { LayoutDashboard } from '@/components/LayoutDashboard'
import { Toaster } from '@/components/ui/toaster'


export default async function Layout({ children }) {
  return (
            <LayoutDashboard>
              {children}
              <Toaster />
            </LayoutDashboard>
          )
}
