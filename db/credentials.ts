export const serverCreds = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
}

export const localURL = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.host}`
  : 'http://localhost:3000'

export const clientCreds = {
  supabaseUrl: process.env.NEXT_PUBLIC_PROXY
    ? `${localURL}/api/supabase`
    : process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
}
