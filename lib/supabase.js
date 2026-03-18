import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hpqpzotvcdgpuqtxlczm.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_m95QtVSOZqygj_SWvfZanQ_NoTv5ugs'

export const supabase = createClient(supabaseUrl, supabaseKey)
