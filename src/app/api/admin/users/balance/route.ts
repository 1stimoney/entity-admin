import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: Request) {
  const { user_id, delta, note } = await req.json()

  if (!user_id || typeof delta !== 'number') {
    return NextResponse.json(
      { status: false, message: 'Invalid data' },
      { status: 400 }
    )
  }

  // fetch current
  const { data: urow, error: uerr } = await supabaseAdmin
    .from('users')
    .select('balance,email')
    .eq('id', user_id)
    .single()

  if (uerr || !urow)
    return NextResponse.json(
      { status: false, message: 'User not found' },
      { status: 404 }
    )

  const newBalance = Number(urow.balance ?? 0) + delta

  const { error: upErr } = await supabaseAdmin
    .from('users')
    .update({ balance: newBalance })
    .eq('id', user_id)

  if (upErr)
    return NextResponse.json(
      { status: false, message: upErr.message },
      { status: 400 }
    )

  // Optional: log an admin transaction row (recommended)
  await supabaseAdmin.from('transactions').insert({
    user_id,
    user_email: urow.email,
    type: 'admin_adjustment',
    amount: Math.abs(delta),
    status: 'success',
    note: note ?? (delta >= 0 ? 'Admin credit' : 'Admin debit'),
  })

  return NextResponse.json({ status: true, data: { user_id, newBalance } })
}
