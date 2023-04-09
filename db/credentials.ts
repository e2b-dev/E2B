const baseURL = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.host}`
  : '<THIS-SHOULD-BE-URL>'

export const credentials = {
  supabaseUrl: process.env.SUPABASE_URL || `${baseURL}/api/supabase`,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
}
