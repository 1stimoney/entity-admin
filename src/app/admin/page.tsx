// app/admin/page.tsx
import Link from 'next/link'
import { cookies } from 'next/headers'
import {
  ArrowUpRight,
  ArrowDownLeft,
  Users,
  Layers,
  BadgeDollarSign,
  Wallet,
  ReceiptText,
  Gift,
  Coins,
  Clock3,
} from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

type TxRow = {
  id: string
  user_id: string | null
  user_email: string | null
  type: string | null
  amount: number | null
  status: string | null
  created_at: string
  flutterwave_ref: string | null
}

type WithdrawalRow = {
  id: string
  user_id: string | null
  email: string | null
  amount: number | null
  status: string | null
  created_at: string
  flutterwave_ref: string | null
  bank_name: string | null
}

type PayoutRow = {
  id: string
  created_at: string
  amount: number | null
  user_id: string
  investment_id: string
}

function fmtNGN(n: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(n)
}

function statusBadgeVariant(s: string) {
  const v = (s || '').toLowerCase()
  if (['success', 'successful', 'completed', 'paid'].includes(v))
    return 'default'
  if (['failed', 'error', 'cancelled'].includes(v)) return 'destructive'
  return 'secondary'
}

export default async function AdminHomePage() {
  // ---- Stats ----
  const [
    usersCountRes,
    plansCountRes,
    txCountRes,
    wdCountRes,
    pendingWdRes,
    successTxRes,

    // ✅ payouts summary via RPC
    payoutsSummaryRes,

    // ✅ recent payouts rows
    recentPayoutsRes,
  ] = await Promise.all([
    supabaseAdmin.from('users').select('id', { count: 'exact', head: true }),
    supabaseAdmin
      .from('investment_plans')
      .select('id', { count: 'exact', head: true }),
    supabaseAdmin
      .from('transactions')
      .select('id', { count: 'exact', head: true }),
    supabaseAdmin
      .from('withdrawals')
      .select('id', { count: 'exact', head: true }),
    supabaseAdmin
      .from('withdrawals')
      .select('id', { count: 'exact', head: true })
      .in('status', ['initiated', 'processing', 'pending']),
    supabaseAdmin
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'success'),

    // If function doesn't exist yet, this will error — we'll handle safely below
    supabaseAdmin.rpc('admin_payouts_today_summary'),

    supabaseAdmin
      .from('investment_payouts')
      .select('id,created_at,amount,user_id,investment_id')
      .order('created_at', { ascending: false })
      .limit(6),
  ])

  const usersCount = usersCountRes.count ?? 0
  const plansCount = plansCountRes.count ?? 0
  const txCount = txCountRes.count ?? 0
  const wdCount = wdCountRes.count ?? 0
  const pendingWithdrawals = pendingWdRes.count ?? 0
  const successfulTx = successTxRes.count ?? 0

  // ✅ payouts today summary (safe defaults if rpc/table not ready)
  const payoutSummaryRow = Array.isArray(payoutsSummaryRes.data)
    ? payoutsSummaryRes.data[0]
    : null

  const totalPaidToday = Number(payoutSummaryRow?.total_paid_today ?? 0)
  const payoutsCountToday = Number(payoutSummaryRow?.payouts_count_today ?? 0)
  const usersCreditedToday = Number(payoutSummaryRow?.users_credited_today ?? 0)
  const investmentsPaidToday = Number(
    payoutSummaryRow?.investments_paid_today ?? 0
  )

  const recentPayouts = (recentPayoutsRes.data || []) as PayoutRow[]

  // ---- Recent activity ----
  const [recentTxRes, recentWdRes] = await Promise.all([
    supabaseAdmin
      .from('transactions')
      .select(
        'id,user_id,user_email,type,amount,status,created_at,flutterwave_ref'
      )
      .order('created_at', { ascending: false })
      .limit(6),
    supabaseAdmin
      .from('withdrawals')
      .select(
        'id,user_id,email,amount,status,created_at,flutterwave_ref,bank_name'
      )
      .order('created_at', { ascending: false })
      .limit(6),
  ])

  const recentTx = (recentTxRes.data || []) as TxRow[]
  const recentWd = (recentWdRes.data || []) as WithdrawalRow[]

  return (
    <div className='mx-auto max-w-6xl p-6 space-y-6'>
      {/* Header */}
      <div className='flex items-start justify-between gap-4'>
        <div>
          <h1 className='text-3xl font-bold'>Admin Dashboard</h1>
          <p className='text-sm text-slate-600 mt-1'>
            Overview of users, plans, transactions and withdrawals.
          </p>
        </div>

        <div className='flex gap-2'>
          <Link href='/admin/users'>
            <Button variant='outline'>Manage users</Button>
          </Link>
          <Link href='/admin/withdrawals'>
            <Button>
              Review withdrawals
              {pendingWithdrawals > 0 ? (
                <Badge className='ml-2' variant='secondary'>
                  {pendingWithdrawals}
                </Badge>
              ) : null}
            </Button>
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
        <Card className='p-5 rounded-2xl'>
          <div className='flex items-center justify-between'>
            <div className='space-y-1'>
              <div className='text-sm text-slate-600'>Total users</div>
              <div className='text-2xl font-bold'>{usersCount}</div>
            </div>
            <div className='h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center'>
              <Users className='h-5 w-5 text-slate-700' />
            </div>
          </div>
          <div className='mt-4 flex gap-2'>
            <Link href='/admin/users'>
              <Button size='sm' variant='outline'>
                View users
              </Button>
            </Link>
            <Link href='/admin/referrals'>
              <Button size='sm' variant='ghost'>
                Referrals
              </Button>
            </Link>
          </div>
        </Card>

        <Card className='p-5 rounded-2xl'>
          <div className='flex items-center justify-between'>
            <div className='space-y-1'>
              <div className='text-sm text-slate-600'>Investment plans</div>
              <div className='text-2xl font-bold'>{plansCount}</div>
            </div>
            <div className='h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center'>
              <Layers className='h-5 w-5 text-slate-700' />
            </div>
          </div>
          <div className='mt-4 flex gap-2'>
            <Link href='/admin/plans'>
              <Button size='sm' variant='outline'>
                Manage plans
              </Button>
            </Link>
            <Link href='/invest-now'>
              <Button size='sm' variant='ghost'>
                Preview user view
              </Button>
            </Link>
          </div>
        </Card>

        <Card className='p-5 rounded-2xl'>
          <div className='flex items-center justify-between'>
            <div className='space-y-1'>
              <div className='text-sm text-slate-600'>Transactions</div>
              <div className='text-2xl font-bold'>{txCount}</div>
              <div className='text-xs text-slate-500'>
                Successful: <span className='font-medium'>{successfulTx}</span>
              </div>
            </div>
            <div className='h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center'>
              <ReceiptText className='h-5 w-5 text-slate-700' />
            </div>
          </div>
          <div className='mt-4 flex gap-2'>
            <Link href='/admin/transactions'>
              <Button size='sm' variant='outline'>
                View all
              </Button>
            </Link>
            <Link href='/admin/investments'>
              <Button size='sm' variant='ghost'>
                Investments
              </Button>
            </Link>
          </div>
        </Card>

        <Card className='p-5 rounded-2xl'>
          <div className='flex items-center justify-between'>
            <div className='space-y-1'>
              <div className='text-sm text-slate-600'>Withdrawals</div>
              <div className='text-2xl font-bold'>{wdCount}</div>
              <div className='text-xs text-slate-500'>
                Pending:{' '}
                <span className='font-medium'>{pendingWithdrawals}</span>
              </div>
            </div>
            <div className='h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center'>
              <Wallet className='h-5 w-5 text-slate-700' />
            </div>
          </div>
          <div className='mt-4 flex gap-2'>
            <Link href='/admin/withdrawals'>
              <Button size='sm' variant='outline'>
                Review
              </Button>
            </Link>
            <Link href='/admin/payouts'>
              <Button size='sm' variant='ghost'>
                Payout logs
              </Button>
            </Link>
          </div>
        </Card>

        {/* ✅ NEW: Returns paid today */}
        <Card className='p-5 rounded-2xl'>
          <div className='flex items-center justify-between'>
            <div className='space-y-1'>
              <div className='text-sm text-slate-600'>Returns paid today</div>
              <div className='text-2xl font-bold'>{fmtNGN(totalPaidToday)}</div>

              <div className='text-xs text-slate-500'>
                {payoutsCountToday} payouts • {usersCreditedToday} users •{' '}
                {investmentsPaidToday} investments
              </div>
            </div>

            <div className='h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center'>
              <Coins className='h-5 w-5 text-slate-700' />
            </div>
          </div>

          <div className='mt-4 flex gap-2'>
            <Link href='/admin/payouts'>
              <Button size='sm' variant='outline'>
                View payouts
              </Button>
            </Link>
            <Link href='/admin/investments'>
              <Button size='sm' variant='ghost'>
                Active investments
              </Button>
            </Link>
          </div>
        </Card>

        <Card className='p-5 rounded-2xl'>
          <div className='flex items-center justify-between'>
            <div className='space-y-1'>
              <div className='text-sm text-slate-600'>Referral rewards</div>
              <div className='text-2xl font-bold'>₦2,000</div>
              <div className='text-xs text-slate-500'>
                Reward per referred investment
              </div>
            </div>
            <div className='h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center'>
              <Gift className='h-5 w-5 text-slate-700' />
            </div>
          </div>
          <div className='mt-4 flex gap-2'>
            <Link href='/admin/referrals'>
              <Button size='sm' variant='outline'>
                View referrals
              </Button>
            </Link>
            <Link href='/admin/rewards'>
              <Button size='sm' variant='ghost'>
                Rewards ledger
              </Button>
            </Link>
          </div>
        </Card>

        <Card className='p-5 rounded-2xl'>
          <div className='flex items-center justify-between'>
            <div className='space-y-1'>
              <div className='text-sm text-slate-600'>Payments</div>
              <div className='text-2xl font-bold'>Flutterwave</div>
              <div className='text-xs text-slate-500'>
                Verify & reconcile payments
              </div>
            </div>
            <div className='h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center'>
              <BadgeDollarSign className='h-5 w-5 text-slate-700' />
            </div>
          </div>
          <div className='mt-4 flex gap-2'>
            <Link href='/admin/reconcile'>
              <Button size='sm' variant='outline'>
                Reconcile
              </Button>
            </Link>
            <Link href='/admin/settings'>
              <Button size='sm' variant='ghost'>
                Settings
              </Button>
            </Link>
          </div>
        </Card>
      </div>

      {/* ✅ Recent payouts panel */}
      <Card className='p-5 rounded-2xl'>
        <div className='flex items-center justify-between'>
          <div>
            <h2 className='text-lg font-semibold'>Recent returns payouts</h2>
            <p className='text-sm text-slate-600'>
              Latest balance credits from active investments.
            </p>
          </div>

          <Link href='/admin/payouts'>
            <Button size='sm' variant='outline'>
              View all
            </Button>
          </Link>
        </div>

        <Separator className='my-4' />

        {recentPayouts.length === 0 ? (
          <p className='text-sm text-slate-600'>No payout logs yet.</p>
        ) : (
          <div className='space-y-3'>
            {recentPayouts.map((p) => (
              <div
                key={p.id}
                className='flex items-start justify-between gap-3 rounded-xl border bg-white p-3'
              >
                <div className='min-w-0'>
                  <div className='flex items-center gap-2'>
                    <Clock3 className='h-4 w-4 text-slate-600' />
                    <div className='font-medium text-sm truncate'>
                      User: {p.user_id.slice(0, 8)}…
                    </div>
                    <Badge variant='secondary'>credited</Badge>
                  </div>

                  <div className='text-xs text-slate-500 mt-1 truncate'>
                    Investment: {p.investment_id.slice(0, 8)}…
                  </div>

                  <div className='text-xs text-slate-500 mt-1'>
                    {new Date(p.created_at).toLocaleString()}
                  </div>
                </div>

                <div className='text-right shrink-0'>
                  <div className='font-semibold text-sm text-green-700'>
                    {fmtNGN(Number(p.amount ?? 0))}
                  </div>
                  <div className='text-xs text-slate-500'>daily return</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Recent Activity */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
        <Card className='p-5 rounded-2xl'>
          <div className='flex items-center justify-between'>
            <div>
              <h2 className='text-lg font-semibold'>Recent transactions</h2>
              <p className='text-sm text-slate-600'>
                Latest investment payment attempts.
              </p>
            </div>
            <Link href='/admin/transactions'>
              <Button size='sm' variant='outline'>
                View all
              </Button>
            </Link>
          </div>

          <Separator className='my-4' />

          {recentTx.length === 0 ? (
            <p className='text-sm text-slate-600'>No transactions yet.</p>
          ) : (
            <div className='space-y-3'>
              {recentTx.map((t) => (
                <div
                  key={t.id}
                  className='flex items-start justify-between gap-3 rounded-xl border bg-white p-3'
                >
                  <div className='min-w-0'>
                    <div className='flex items-center gap-2'>
                      <ArrowUpRight className='h-4 w-4 text-green-600' />
                      <div className='font-medium text-sm truncate'>
                        {t.user_email ?? 'Unknown user'}
                      </div>
                      <Badge variant={statusBadgeVariant(t.status ?? '')}>
                        {t.status ?? 'pending'}
                      </Badge>
                    </div>
                    <div className='text-xs text-slate-500 mt-1 truncate'>
                      Ref: {t.flutterwave_ref ?? t.id}
                    </div>
                    <div className='text-xs text-slate-500 mt-1'>
                      {new Date(t.created_at).toLocaleString()}
                    </div>
                  </div>

                  <div className='text-right shrink-0'>
                    <div className='font-semibold text-sm text-green-700'>
                      {fmtNGN(Number(t.amount ?? 0))}
                    </div>
                    <div className='text-xs text-slate-500'>
                      {t.type ?? 'investment'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className='p-5 rounded-2xl'>
          <div className='flex items-center justify-between'>
            <div>
              <h2 className='text-lg font-semibold'>Recent withdrawals</h2>
              <p className='text-sm text-slate-600'>
                Latest withdrawal requests & statuses.
              </p>
            </div>
            <Link href='/admin/withdrawals'>
              <Button size='sm' variant='outline'>
                Review
              </Button>
            </Link>
          </div>

          <Separator className='my-4' />

          {recentWd.length === 0 ? (
            <p className='text-sm text-slate-600'>No withdrawals yet.</p>
          ) : (
            <div className='space-y-3'>
              {recentWd.map((w) => (
                <div
                  key={w.id}
                  className='flex items-start justify-between gap-3 rounded-xl border bg-white p-3'
                >
                  <div className='min-w-0'>
                    <div className='flex items-center gap-2'>
                      <ArrowDownLeft className='h-4 w-4 text-red-600' />
                      <div className='font-medium text-sm truncate'>
                        {w.email ?? 'Unknown user'}
                      </div>
                      <Badge variant={statusBadgeVariant(w.status ?? '')}>
                        {w.status ?? 'initiated'}
                      </Badge>
                    </div>
                    <div className='text-xs text-slate-500 mt-1 truncate'>
                      {w.bank_name ? `Bank: ${w.bank_name}` : 'Bank: —'} • Ref:{' '}
                      {w.flutterwave_ref ?? w.id}
                    </div>
                    <div className='text-xs text-slate-500 mt-1'>
                      {new Date(w.created_at).toLocaleString()}
                    </div>
                  </div>

                  <div className='text-right shrink-0'>
                    <div className='font-semibold text-sm text-red-700'>
                      {fmtNGN(Number(w.amount ?? 0))}
                    </div>
                    <div className='text-xs text-slate-500'>withdrawal</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Footer shortcuts */}
      <Card className='p-5 rounded-2xl'>
        <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-3'>
          <div>
            <div className='font-semibold'>Quick actions</div>
            <div className='text-sm text-slate-600'>
              Jump straight into common admin tasks.
            </div>
          </div>

          <div className='flex flex-wrap gap-2'>
            <Link href='/admin/users'>
              <Button variant='outline'>Users</Button>
            </Link>
            <Link href='/admin/transactions'>
              <Button variant='outline'>Transactions</Button>
            </Link>
            <Link href='/admin/withdrawals'>
              <Button variant='outline'>Withdrawals</Button>
            </Link>
            <Link href='/admin/plans'>
              <Button variant='outline'>Plans</Button>
            </Link>
            <Link href='/admin/referrals'>
              <Button variant='outline'>Referrals</Button>
            </Link>
            <Link href='/admin/payouts'>
              <Button variant='outline'>Payouts</Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  )
}
