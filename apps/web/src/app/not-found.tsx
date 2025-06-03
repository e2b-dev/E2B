import { redirect, RedirectType } from 'next/navigation'

export default async function NotFound() {
  throw redirect('https://e2b.dev/docs', RedirectType.replace)
}
