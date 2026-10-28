import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && key)

// The client is only created when configured; App shows a setup screen otherwise.
export const supabase = isSupabaseConfigured ? createClient(url!, key!) : null!
