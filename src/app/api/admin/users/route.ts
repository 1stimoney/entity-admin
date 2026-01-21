import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select(
      'id,email,first_name,last_name,balance,role,created_at,points,referral_code,referred_by'
    )
    .order('created_at', { ascending: false })

  if (error)
    return NextResponse.json(
      { status: false, message: error.message },
      { status: 400 }
    )
  return NextResponse.json({ status: true, data })
}
