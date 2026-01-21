import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: Request) {
  try {
    const { user_id, user_email, amount, note } = await req.json()

    if (!user_id || !user_email || !amount) {
      return NextResponse.json({ status: false, message: 'Invalid data' })
    }

    // 1) Update user balance atomically via RPC if you have add_balance
    // If you DON'T have it, we’ll do read+update fallback.
    const { error: rpcErr } = await supabaseAdmin.rpc('add_balance', {
      user_id,
      amount_to_add: Number(amount),
    })

    if (rpcErr) {
      // fallback read+update
      const { data: u } = await supabaseAdmin
        .from('users')
        .select('balance')
        .eq('id', user_id)
        .single()

      const current = Number(u?.balance ?? 0)

      const { error: upErr } = await supabaseAdmin
        .from('users')
        .update({ balance: current + Number(amount) })
        .eq('id', user_id)

      if (upErr) {
        return NextResponse.json({ status: false, message: upErr.message })
      }
    }

    // 2) Log transaction
    const { error: tErr } = await supabaseAdmin.from('transactions').insert({
      user_id,
      user_email,
      type: 'balance_added',
      amount: Number(amount),
      status: 'success',
      note: note ?? null,
    })

    if (tErr) {
      // balance already updated; still report log failure
      return NextResponse.json({
        status: false,
        message: 'Balance updated but failed to log transaction',
        error: tErr.message,
      })
    }

    return NextResponse.json({ status: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ status: false, message: 'Server error' })
  }
}
