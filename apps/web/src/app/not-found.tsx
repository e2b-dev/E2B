import { redirect } from 'next/navigation'

export default async function NotFound() {
  throw redirect('/docs')
}
