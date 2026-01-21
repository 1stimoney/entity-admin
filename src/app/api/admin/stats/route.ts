import { NextResponse } from 'next/server'
import { requireAdmin } from '../_utils'
import { supabaseServer } from '@/lib/supabaseServer'

export async function GET() {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.res

  // Lightweight counts (use head:true for faster counts)
  const [users, transactions, withdrawals, investments] = await Promise.all([
    supabaseServer.from('users').select('id', { count: 'exact', head: true }),
    supabaseServer
      .from('transactions')
      .select('id', { count: 'exact', head: true }),
    supabaseServer
      .from('withdrawals')
      .select('id', { count: 'exact', head: true }),
    supabaseServer
      .from('investments')
      .select('id', { count: 'exact', head: true }),
  ])

  return NextResponse.json({
    status: true,
    data: {
      users: users.count ?? 0,
      transactions: transactions.count ?? 0,
      withdrawals: withdrawals.count ?? 0,
      investments: investments.count ?? 0,
    },
  })
}
