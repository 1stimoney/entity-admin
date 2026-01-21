import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('withdrawals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)

  if (error)
    return NextResponse.json(
      { status: false, message: error.message },
      { status: 400 }
    )
  return NextResponse.json({ status: true, data })
}
