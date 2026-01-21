/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: Request) {
  const { id, action, reason } = await req.json()
  if (!id || !['approve', 'deny'].includes(action)) {
    return NextResponse.json(
      { status: false, message: 'Invalid request' },
      { status: 400 }
    )
  }

  // NOTE:
  // Your current withdrawal flow already initiates transfer immediately.
  // So "approve/deny" here is status management + auditing.
  // If you later change flow to "pending_review", approval can trigger payout.

  const status = action === 'approve' ? 'approved' : 'denied'

  const patch: any = { status }
  if (action === 'deny') patch.error = reason ?? 'Denied by admin'

  const { error } = await supabaseAdmin
    .from('withdrawals')
    .update(patch)
    .eq('id', id)

  if (error)
    return NextResponse.json(
      { status: false, message: error.message },
      { status: 400 }
    )
  return NextResponse.json({ status: true })
}
