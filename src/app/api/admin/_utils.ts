import { NextResponse } from 'next/server'
import { supabaseServerAuth } from '@/lib/supabaseServerAuth'
import { isAdminEmail } from '@/lib/admin'

export async function requireAdmin() {
  const supabase = supabaseServerAuth()
  const {
    data: { user },
  } = await (await supabase).auth.getUser()

  if (!user) {
    return {
      ok: false as const,
      res: NextResponse.json({ message: 'Unauthorized' }, { status: 401 }),
    }
  }

  if (!isAdminEmail(user.email)) {
    return {
      ok: false as const,
      res: NextResponse.json({ message: 'Forbidden' }, { status: 403 }),
    }
  }

  return { ok: true as const, user }
}
