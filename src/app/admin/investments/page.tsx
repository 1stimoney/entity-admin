/* eslint-disable @typescript-eslint/no-explicit-any */
// app/admin/investments/page.tsx
import Link from 'next/link'
import { cookies } from 'next/headers'
import {
  ArrowLeft,
  Search,
  Layers,
  Timer,
  User as UserIcon,
  Coins,
  CalendarDays,
  ExternalLink,
} from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const PER_PAGE = 20
const VALIDITY_DAYS = 30

type InvestmentRow = {
  id: string
  created_at: string
  amount: number | null
  package_id: string
  user_id: string
  status: string | null
  source_transaction_id: string | null

  // newer fields (optional)
  start_at?: string | null
  end_at?: string | null
  daily_return?: number | null
  last_paid_at?: string | null
}

type PlanRow = {
  id: string
  name: string | null
  amount: number | null
  daily_return?: number | null
}

type UserRow = {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
}

type PayoutAggRow = {
  investment_id: string
  payouts_count: number
  payouts_sum: number
  last_payout_at: string | null
}

function fmtNGN(n: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(n)
}

function safeId(id: any) {
  const s = String(id ?? '')
  return s.length > 10 ? `${s.slice(0, 10)}…` : s
}

function statusVariant(status?: string | null) {
  const s = (status ?? '').toLowerCase()
  if (['active', 'running', 'success', 'successful', 'completed'].includes(s))
    return 'default'
  if (['cancelled', 'canceled', 'failed', 'error'].includes(s))
    return 'destructive'
  return 'secondary'
}

function isExplicitInactive(status?: string | null) {
  const s = (status ?? '').toLowerCase()
  return ['cancelled', 'canceled', 'failed', 'error'].includes(s)
}

function startDate(inv: InvestmentRow) {
  const base = inv.start_at ?? inv.created_at
  return new Date(base)
}

function endDate(inv: InvestmentRow) {
  if (inv.end_at) return new Date(inv.end_at)
  const s = startDate(inv)
  const e = new Date(s)
  e.setDate(e.getDate() + VALIDITY_DAYS)
  return e
}

function isActive(inv: InvestmentRow) {
  if (isExplicitInactive(inv.status)) return false
  return Date.now() < endDate(inv).getTime()
}

function daysLeft(inv: InvestmentRow) {
  const expiry = endDate(inv).getTime()
  const now = Date.now()
  const diff = expiry - now
  if (diff <= 0) return 0
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function nextPayoutDate(inv: InvestmentRow, lastPayoutAt?: string | null) {
  // If never paid, next payout is "today" or start day (but on admin we show a date suggestion)
  const base = lastPayoutAt ? new Date(lastPayoutAt) : startDate(inv)
  const next = new Date(base)
  next.setDate(next.getDate() + 1)
  return next
}

export default async function AdminInvestmentsPage(props: {
  searchParams?: Promise<{
    q?: string
    page?: string
    tab?: 'all' | 'active' | 'expired'
  }>
}) {
  const searchParams = (await props.searchParams) ?? {}
  const q = (searchParams.q ?? '').trim()
  const tab = (searchParams.tab ?? 'all') as 'all' | 'active' | 'expired'
  const page = Math.max(0, Number(searchParams.page ?? 0))

  // ---------- Load investments ----------
  const from = page * PER_PAGE
  const to = from + PER_PAGE - 1

  // NOTE: select optional fields if they exist in your table.
  // If your table doesn't have start_at/end_at/daily_return/last_paid_at, Supabase returns nulls (fine).
  const invRes = await supabaseAdmin
    .from('investments')
    .select(
      'id,created_at,amount,package_id,user_id,status,source_transaction_id,start_at,end_at,daily_return,last_paid_at',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, to)

  const investments = (invRes.data ?? []) as InvestmentRow[]
  const totalCount = invRes.count ?? 0

  // ---------- Load referenced users & plans ----------
  const userIds = Array.from(new Set(investments.map((i) => i.user_id)))
  const planIds = Array.from(new Set(investments.map((i) => i.package_id)))
  const invIds = Array.from(new Set(investments.map((i) => i.id)))

  const [usersRes, plansRes] = await Promise.all([
    userIds.length
      ? supabaseAdmin
          .from('users')
          .select('id,email,first_name,last_name')
          .in('id', userIds)
      : Promise.resolve({ data: [] as any[] }),
    planIds.length
      ? supabaseAdmin
          .from('investment_plans')
          .select('id,name,amount,daily_return')
          .in('id', planIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const usersMap: Record<string, UserRow> = {}
  ;(usersRes.data ?? []).forEach((u: any) => (usersMap[u.id] = u as UserRow))

  const plansMap: Record<string, PlanRow> = {}
  ;(plansRes.data ?? []).forEach((p: any) => (plansMap[p.id] = p as PlanRow))

  // ---------- Payout aggregates for this page ----------
  // We do it in Node for now (safe for admin scale). If this grows big, move to a SQL view/RPC.
  const payoutsMap: Record<string, PayoutAggRow> = {}

  if (invIds.length) {
    // Try to read payout_date first; if your table doesn't have it, created_at still exists.
    const payoutsRes = await supabaseAdmin
      .from('investment_payouts')
      .select('investment_id, amount, created_at, payout_date')
      .in('investment_id', invIds)

    ;(payoutsRes.data ?? []).forEach((r: any) => {
      const invId = String(r.investment_id)
      const amt = Number(r.amount ?? 0)
      const payoutAt = (r.payout_date ?? r.created_at ?? null) as string | null

      if (!payoutsMap[invId]) {
        payoutsMap[invId] = {
          investment_id: invId,
          payouts_count: 0,
          payouts_sum: 0,
          last_payout_at: null,
        }
      }

      const row = payoutsMap[invId]
      row.payouts_count += 1
      row.payouts_sum += amt

      if (payoutAt) {
        if (!row.last_payout_at) row.last_payout_at = payoutAt
        else {
          const prev = new Date(row.last_payout_at).getTime()
          const cur = new Date(payoutAt).getTime()
          if (cur > prev) row.last_payout_at = payoutAt
        }
      }
    })
  }

  // ---------- Search + tab filter (on loaded page) ----------
  const visible = investments.filter((inv) => {
    const u = usersMap[inv.user_id]
    const p = plansMap[inv.package_id]

    const fullName = `${u?.first_name ?? ''} ${u?.last_name ?? ''}`.trim()
    const email = (u?.email ?? '').toLowerCase()
    const planName = (p?.name ?? '').toLowerCase()

    const active = isActive(inv)

    if (tab === 'active' && !active) return false
    if (tab === 'expired' && active) return false

    if (!q) return true

    const qLower = q.toLowerCase()
    return (
      String(inv.id).toLowerCase().includes(qLower) ||
      String(inv.user_id).toLowerCase().includes(qLower) ||
      String(inv.package_id).toLowerCase().includes(qLower) ||
      String(inv.source_transaction_id ?? '')
        .toLowerCase()
        .includes(qLower) ||
      email.includes(qLower) ||
      fullName.toLowerCase().includes(qLower) ||
      planName.includes(qLower)
    )
  })

  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE))
  const baseQs = `tab=${tab}${q ? `&q=${encodeURIComponent(q)}` : ''}`
  const prevHref = `/admin/investments?page=${Math.max(0, page - 1)}&${baseQs}`
  const nextHref = `/admin/investments?page=${page + 1}&${baseQs}`

  const tabHref = (t: 'all' | 'active' | 'expired') =>
    `/admin/investments?tab=${t}${q ? `&q=${encodeURIComponent(q)}` : ''}`

  return (
    <div className='mx-auto max-w-7xl p-6 space-y-6'>
      {/* Header */}
      <div className='flex items-start justify-between gap-4'>
        <div>
          <Link href='/admin/payouts'>
            <Button variant='ghost' size='sm' className='gap-2'>
              <ArrowLeft className='h-4 w-4' />
              Back
            </Button>
          </Link>

          <h1 className='text-3xl font-bold mt-2'>Investments</h1>
          <p className='text-sm text-slate-600 mt-1'>
            See who owns each investment, its payout progress, and whether it’s
            active (30 days).
          </p>
        </div>

        <div className='flex gap-2'>
          <Link href='/admin/users'>
            <Button variant='outline'>Users</Button>
          </Link>
          <Link href='/admin/payouts'>
            <Button>Payouts</Button>
          </Link>
        </div>
      </div>

      {/* Controls */}
      <Card className='p-4 rounded-2xl'>
        <form
          action='/admin/investments'
          className='flex flex-col md:flex-row gap-3'
        >
          <input type='hidden' name='tab' value={tab} />

          <div className='relative flex-1'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500' />
            <input
              name='q'
              defaultValue={q}
              placeholder='Search by user name, email, plan, investment id...'
              className='w-full rounded-xl border bg-white px-10 py-2 text-sm outline-none'
            />
          </div>

          <Button type='submit' className='md:w-[140px]'>
            Search
          </Button>
        </form>

        <div className='mt-3 flex flex-wrap gap-2'>
          <Link href={tabHref('all')}>
            <Button variant={tab === 'all' ? 'default' : 'outline'} size='sm'>
              All
            </Button>
          </Link>
          <Link href={tabHref('active')}>
            <Button
              variant={tab === 'active' ? 'default' : 'outline'}
              size='sm'
            >
              Active
            </Button>
          </Link>
          <Link href={tabHref('expired')}>
            <Button
              variant={tab === 'expired' ? 'default' : 'outline'}
              size='sm'
            >
              Expired
            </Button>
          </Link>

          <Badge variant='secondary' className='ml-auto'>
            {totalCount} total
          </Badge>
        </div>
      </Card>

      {/* Table */}
      <Card className='rounded-2xl overflow-hidden'>
        <div className='p-4 flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <Layers className='h-4 w-4 text-slate-600' />
            <div className='font-semibold'>Investments list</div>
          </div>
          <div className='text-xs text-slate-500'>
            Page {page + 1} / {totalPages}
          </div>
        </div>

        <Separator />

        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead className='bg-slate-50'>
              <tr className='text-left'>
                <th className='p-3'>User</th>
                <th className='p-3'>Plan</th>
                <th className='p-3'>Amount</th>
                <th className='p-3'>Validity</th>
                <th className='p-3'>Payouts</th>
                <th className='p-3'>Status</th>
                <th className='p-3'>Created</th>
              </tr>
            </thead>

            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td className='p-6 text-slate-600' colSpan={7}>
                    No investments match your filter.
                  </td>
                </tr>
              ) : (
                visible.map((inv) => {
                  const u = usersMap[inv.user_id]
                  const p = plansMap[inv.package_id]

                  const name =
                    `${u?.first_name ?? ''} ${u?.last_name ?? ''}`.trim() || '—'
                  const email = u?.email ?? '—'
                  const planName = p?.name ?? 'Unknown plan'

                  const active = isActive(inv)
                  const left = daysLeft(inv)
                  const starts = startDate(inv)
                  const ends = endDate(inv)

                  const dailyReturn =
                    Number(inv.daily_return ?? p?.daily_return ?? 0) || 0

                  const payoutAgg = payoutsMap[String(inv.id)]
                  const daysPaid = Math.min(
                    VALIDITY_DAYS,
                    payoutAgg?.payouts_count ?? 0
                  )
                  const totalPaid = payoutAgg?.payouts_sum ?? 0
                  const lastPaidAt = payoutAgg?.last_payout_at ?? null
                  const nextPaid = nextPayoutDate(inv, lastPaidAt)

                  const progressPct = Math.min(
                    100,
                    Math.round((daysPaid / VALIDITY_DAYS) * 100)
                  )

                  return (
                    <tr key={String(inv.id)} className='border-t align-top'>
                      {/* User */}
                      <td className='p-3'>
                        <div className='flex items-start gap-2'>
                          <div className='h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0'>
                            <UserIcon className='h-4 w-4 text-slate-700' />
                          </div>

                          <div className='min-w-0'>
                            <div className='font-medium truncate'>{name}</div>
                            <div className='text-xs text-slate-500 truncate'>
                              {email}
                            </div>
                            <div className='text-[11px] text-slate-400 mt-1 truncate'>
                              {inv.user_id}
                            </div>

                            <div className='mt-2 flex flex-wrap gap-2'>
                              <Link href={`/admin/users/${inv.user_id}`}>
                                <Button size='sm' variant='outline'>
                                  View user
                                </Button>
                              </Link>
                              <Link
                                href={`/admin/payouts?q=${encodeURIComponent(
                                  String(inv.id)
                                )}`}
                              >
                                <Button
                                  size='sm'
                                  variant='ghost'
                                  className='gap-2'
                                >
                                  Payouts
                                  <ExternalLink className='h-4 w-4' />
                                </Button>
                              </Link>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Plan */}
                      <td className='p-3'>
                        <div className='font-medium'>{planName}</div>
                        <div className='text-xs text-slate-500 mt-1'>
                          Plan ID: {safeId(inv.package_id)}
                        </div>
                        <div className='text-xs text-slate-500 mt-1 flex items-center gap-2'>
                          <Coins className='h-4 w-4 text-slate-600' />
                          Daily return:{' '}
                          <span className='font-medium text-slate-800'>
                            {fmtNGN(dailyReturn)}
                          </span>
                        </div>
                      </td>

                      {/* Amount */}
                      <td className='p-3'>
                        <div className='font-semibold text-slate-900'>
                          {fmtNGN(Number(inv.amount ?? p?.amount ?? 0))}
                        </div>
                        <div className='text-xs text-slate-500 mt-1'>
                          Source Tx:{' '}
                          {inv.source_transaction_id
                            ? safeId(inv.source_transaction_id)
                            : '—'}
                        </div>
                        <div className='text-xs text-slate-500 mt-1'>
                          Investment ID: {safeId(inv.id)}
                        </div>
                      </td>

                      {/* Validity */}
                      <td className='p-3'>
                        <div className='flex items-center gap-2'>
                          <Timer className='h-4 w-4 text-slate-600' />
                          <Badge variant={active ? 'default' : 'secondary'}>
                            {active ? 'Active' : 'Expired'}
                          </Badge>
                        </div>

                        <div className='text-xs text-slate-500 mt-2'>
                          <div>
                            Starts:{' '}
                            <span className='font-medium text-slate-800'>
                              {starts.toLocaleDateString()}
                            </span>
                          </div>
                          <div>
                            Ends:{' '}
                            <span className='font-medium text-slate-800'>
                              {ends.toLocaleDateString()}
                            </span>
                          </div>
                          <div className='mt-1'>
                            {active ? (
                              <>
                                Days left:{' '}
                                <span className='font-medium text-slate-800'>
                                  {left}
                                </span>
                              </>
                            ) : (
                              <span className='text-slate-600'>Expired</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Payouts */}
                      <td className='p-3'>
                        <div className='flex items-center gap-2'>
                          <CalendarDays className='h-4 w-4 text-slate-600' />
                          <div className='font-medium'>
                            {daysPaid}/{VALIDITY_DAYS} days
                          </div>
                        </div>

                        <div className='mt-2'>
                          <div className='h-2 w-full rounded-full bg-slate-100 overflow-hidden'>
                            <div
                              className='h-2 bg-slate-900'
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                          <div className='text-[11px] text-slate-500 mt-1'>
                            Progress: {progressPct}%
                          </div>
                        </div>

                        <div className='text-xs text-slate-500 mt-2 space-y-1'>
                          <div>
                            Total paid:{' '}
                            <span className='font-medium text-slate-800'>
                              {fmtNGN(Number(totalPaid))}
                            </span>
                          </div>
                          <div>
                            Last payout:{' '}
                            <span className='font-medium text-slate-800'>
                              {lastPaidAt
                                ? new Date(lastPaidAt).toLocaleString()
                                : '—'}
                            </span>
                          </div>
                          <div>
                            Next payout:{' '}
                            <span className='font-medium text-slate-800'>
                              {active ? nextPaid.toLocaleDateString() : '—'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className='p-3'>
                        <Badge variant={statusVariant(inv.status)}>
                          {inv.status ?? 'pending'}
                        </Badge>
                      </td>

                      {/* Created */}
                      <td className='p-3'>
                        <div className='font-medium'>
                          {new Date(inv.created_at).toLocaleString()}
                        </div>
                        <div className='text-xs text-slate-500 mt-1'>
                          ID: {safeId(inv.id)}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <Separator />
        <div className='p-4 flex items-center justify-between'>
          <Link href={prevHref}>
            <Button variant='outline' disabled={page <= 0}>
              Prev
            </Button>
          </Link>

          <div className='text-xs text-slate-500'>
            Showing {from + 1} - {Math.min(to + 1, totalCount)} of {totalCount}
          </div>

          <Link href={nextHref}>
            <Button variant='outline' disabled={page + 1 >= totalPages}>
              Next
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}
