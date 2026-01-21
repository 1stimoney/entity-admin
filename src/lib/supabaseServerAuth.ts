import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function supabaseServerAuth() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          // Next.js server actions/route handlers can set cookies
          // but in server components this can throw; so we try/catch.
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // ignore in server components
          }
        },
      },
    }
  )
}
