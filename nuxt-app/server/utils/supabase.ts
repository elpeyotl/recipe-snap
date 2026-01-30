import { createClient } from '@supabase/supabase-js'

export function useServerSupabase() {
  const config = useRuntimeConfig()
  return createClient(
    config.public.supabaseUrl,
    config.supabaseServiceKey
  )
}
