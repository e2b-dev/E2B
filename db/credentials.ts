export const serverCreds = {
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
}

const baseURL = typeof window !== 'undefined'
  && `${window.location.protocol}//${window.location.host}`

// The SUPABASE_URL is actually not used but we need a valid URL for the SSR render.
export const clientCreds = {
  supabaseUrl: baseURL ? `${baseURL}/api/supabase` : process.env.SUPABASE_URL,
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
}
