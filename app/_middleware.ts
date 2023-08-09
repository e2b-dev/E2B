import { createMiddlewareSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'

import type { NextRequest } from 'next/server'
import { Database } from 'db/supabase'

// From: https://supabase.com/docs/guides/auth/auth-helpers/nextjs#managing-session-with-middleware
// When using the Supabase client on the server, you must perform extra steps to ensure the user's auth session remains active.
// Since the user's session is tracked in a cookie, we need to read this cookie and update it if necessary.
export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  // TODO: Change to createMiddlewareClient after updating @supabase/auth-helpers-nextjs to newest version
  const supabase = createMiddlewareSupabaseClient<Database>({ req, res })
  await supabase.auth.getSession()
  return res
}
