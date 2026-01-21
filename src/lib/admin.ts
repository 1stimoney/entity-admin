import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function isAdminUser() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {
          // no-op in server components
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { ok: false, reason: 'not_logged_in' as const }

  const { data: row, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (error || !row) return { ok: false, reason: 'no_profile' as const }

  return { ok: row.role === 'admin', reason: 'checked' as const }
}
