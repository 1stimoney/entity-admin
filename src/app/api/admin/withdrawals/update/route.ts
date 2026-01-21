import { NextResponse } from 'next/server'
import { requireAdmin } from '../../_utils'
import { supabaseServer } from '@/lib/supabaseServer'

export async function POST(req: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.res

  const { id, status, note } = await req.json()

  if (!id || !status) {
    return NextResponse.json(
      { status: false, message: 'Missing id/status' },
      { status: 400 }
    )
  }

  const { data, error } = await supabaseServer
    .from('withdrawals')
    .update({ status, error: note ?? null })
    .eq('id', id)
    .select('*')
    .single()

  if (error)
    return NextResponse.json(
      { status: false, message: error.message },
      { status: 500 }
    )

  return NextResponse.json({ status: true, data })
}
