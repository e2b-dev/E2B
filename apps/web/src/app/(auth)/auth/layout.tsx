import {Footer} from '@/components/Footer'

export default async function Layout({ children }) {
  return (
    <div className="pt-12">
      {children}
      <Footer />
    </div>
  )
}
