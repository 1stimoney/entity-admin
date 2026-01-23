/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-explicit-any */
// app/admin/payouts/page.tsx
import Link from 'next/link'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import {
  Coins,
  ArrowLeft,
  Search,
  CalendarDays,
  Users as UsersIcon,
} from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

const PER_PAGE = 20

type PayoutRow = {
  id: string
  created_at: string
  payout_date: string | null
  amount: number | null
  user_id: string
  investment_id: string
}

type UserRow = {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
}

type InvestmentRow = {
  id: string
  user_id: string
  package_id: string | null // plan id
}

type PlanRow = {
  id: string
  name: string | null
  daily_return: number | null
}

function fmtNGN(n: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(n)
}

function toISOStartOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x.toISOString()
}

function daysAgoISO(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return toISOStartOfDay(d)
}

function safeSliceId(id: any, n = 10) {
  const s = String(id ?? '')
  return s.length > n ? `${s.slice(0, n)}…` : s || '—'
}

export default async function AdminPayoutsPage(props: {
  searchParams?: Promise<{
    q?: string
    page?: string
    range?: 'today' | '7d' | '30d' | 'all'
  }>
}) {
  const searchParams = (await props.searchParams) ?? {}
  const q = (searchParams.q ?? '').trim()
  const range = (searchParams.range ?? '7d') as 'today' | '7d' | '30d' | 'all'
  const page = Math.max(0, Number(searchParams.page ?? 0))

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {},
      },
    }
  )

  // ---- date filter ----
  let fromISO: string | null = null
  if (range === 'today') fromISO = daysAgoISO(0)
  if (range === '7d') fromISO = daysAgoISO(7)
  if (range === '30d') fromISO = daysAgoISO(30)
  if (range === 'all') fromISO = null

  // ---- summary: today + last 7 days (use payout_date where possible) ----
  // If you only have created_at, keep created_at. But payout_date is the better “day”.
  const [todayAgg, weekAgg] = await Promise.all([
    supabase
      .from('investment_payouts')
      .select('amount,created_at,payout_date')
      .gte('created_at', daysAgoISO(0)),
    supabase
      .from('investment_payouts')
      .select('amount,created_at,payout_date')
      .gte('created_at', daysAgoISO(7)),
  ])

  const todayTotal = (todayAgg.data ?? []).reduce(
    (sum, r: any) => sum + Number(r.amount ?? 0),
    0
  )
  const weekTotal = (weekAgg.data ?? []).reduce(
    (sum, r: any) => sum + Number(r.amount ?? 0),
    0
  )

  // ---- search strategy (server-side, reliable) ----
  // If q is email/name -> find matching user IDs first, then filter payouts by those IDs.
  const looksUuid = /^[0-9a-fA-F-]{8,}$/.test(q)

  let matchedUserIds: string[] = []
  if (q && !looksUuid) {
    const qLower = q.toLowerCase()

    // Pull a limited list of matching users (admin scale)
    const { data: matchUsers } = await supabase
      .from('users')
      .select('id,email,first_name,last_name')
      .limit(2000)

    matchedUserIds = (matchUsers ?? [])
      .filter((u: any) => {
        const email = String(u.email ?? '').toLowerCase()
        const name = `${u.first_name ?? ''} ${u.last_name ?? ''}`
          .trim()
          .toLowerCase()
        return email.includes(qLower) || name.includes(qLower)
      })
      .map((u: any) => u.id)
  }

  // ---- main query ----
  const from = page * PER_PAGE
  const to = from + PER_PAGE - 1

  let payoutsQuery = supabase
    .from('investment_payouts')
    .select('id,created_at,payout_date,amount,user_id,investment_id', {
      count: 'exact',
    })
    .order('created_at', { ascending: false })

  if (fromISO) payoutsQuery = payoutsQuery.gte('created_at', fromISO)

  if (q) {
    if (looksUuid) {
      // uuid-ish: match user_id or investment_id directly
      payoutsQuery = payoutsQuery.or(`user_id.eq.${q},investment_id.eq.${q}`)
    } else if (matchedUserIds.length > 0) {
      // name/email: filter by those user IDs
      payoutsQuery = payoutsQuery.in('user_id', matchedUserIds)
    } else {
      // name/email search but no matched users -> return empty result fast
      const totalPages = 1
      const prevHref = `/admin/payouts?page=0&range=${range}${
        q ? `&q=${encodeURIComponent(q)}` : ''
      }`
      const mkRangeHref = (r: string) =>
        `/admin/payouts?range=${r}${q ? `&q=${encodeURIComponent(q)}` : ''}`

      return (
        <div className='mx-auto max-w-6xl p-6 space-y-6'>
          <div className='flex items-start justify-between gap-4'>
            <div>
              <div className='flex items-center gap-2'>
                <Link href='/admin'>
                  <Button variant='ghost' size='sm' className='gap-2'>
                    <ArrowLeft className='h-4 w-4' />
                    Back
                  </Button>
                </Link>
              </div>

              <h1 className='text-3xl font-bold mt-2'>Payouts</h1>
              <p className='text-sm text-slate-600 mt-1'>
                Daily returns credited to user balances.
              </p>
            </div>
          </div>

          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <Card className='p-5 rounded-2xl'>
              <div className='flex items-center justify-between'>
                <div className='space-y-1'>
                  <div className='text-sm text-slate-600'>Paid today</div>
                  <div className='text-2xl font-bold'>{fmtNGN(todayTotal)}</div>
                </div>
                <div className='h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center'>
                  <Coins className='h-5 w-5 text-slate-700' />
                </div>
              </div>
            </Card>

            <Card className='p-5 rounded-2xl'>
              <div className='flex items-center justify-between'>
                <div className='space-y-1'>
                  <div className='text-sm text-slate-600'>
                    Paid (last 7 days)
                  </div>
                  <div className='text-2xl font-bold'>{fmtNGN(weekTotal)}</div>
                </div>
                <div className='h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center'>
                  <CalendarDays className='h-5 w-5 text-slate-700' />
                </div>
              </div>
            </Card>
          </div>

          <Card className='p-4 rounded-2xl'>
            <form
              action='/admin/payouts'
              className='flex flex-col md:flex-row gap-3'
            >
              <input type='hidden' name='range' value={range} />
              <div className='relative flex-1'>
                <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500' />
                <input
                  name='q'
                  defaultValue={q}
                  placeholder='Search by email, name, user_id, investment_id...'
                  className='w-full rounded-xl border bg-white px-10 py-2 text-sm outline-none'
                />
              </div>

              <div className='flex gap-2'>
                <Link href={mkRangeHref('today')}>
                  <Button variant={range === 'today' ? 'default' : 'outline'}>
                    Today
                  </Button>
                </Link>
                <Link href={mkRangeHref('7d')}>
                  <Button variant={range === '7d' ? 'default' : 'outline'}>
                    7D
                  </Button>
                </Link>
                <Link href={mkRangeHref('30d')}>
                  <Button variant={range === '30d' ? 'default' : 'outline'}>
                    30D
                  </Button>
                </Link>
                <Link href={mkRangeHref('all')}>
                  <Button variant={range === 'all' ? 'default' : 'outline'}>
                    All
                  </Button>
                </Link>
              </div>

              <Button type='submit' className='md:w-[140px]'>
                Search
              </Button>
            </form>
          </Card>

          <Card className='p-6 rounded-2xl'>
            <p className='text-slate-600'>
              No users match: <span className='font-medium'>{q}</span>
            </p>
          </Card>
        </div>
      )
    }
  }

  const payoutsRes = await payoutsQuery.range(from, to)
  const payouts = (payoutsRes.data ?? []) as PayoutRow[]
  const totalCount = payoutsRes.count ?? 0

  // ---- load related users ----
  const userIds = Array.from(new Set(payouts.map((p) => p.user_id)))
  let usersMap: Record<string, UserRow> = {}
  if (userIds.length) {
    const usersRes = await supabase
      .from('users')
      .select('id,email,first_name,last_name')
      .in('id', userIds)

    ;(usersRes.data ?? []).forEach((u: any) => {
      usersMap[u.id] = u as UserRow
    })
  }

  // ---- load related investments -> plans ----
  const invIds = Array.from(new Set(payouts.map((p) => p.investment_id)))
  let invMap: Record<string, InvestmentRow> = {}
  let planIds: string[] = []

  if (invIds.length) {
    const invRes = await supabase
      .from('investments')
      .select('id,user_id,package_id')
      .in('id', invIds)

    ;(invRes.data ?? []).forEach((inv: any) => {
      invMap[inv.id] = inv as InvestmentRow
    })

    planIds = Array.from(
      new Set((invRes.data ?? []).map((x: any) => x.package_id).filter(Boolean))
    )
  }

  let plansMap: Record<string, PlanRow> = {}
  if (planIds.length) {
    const plansRes = await supabase
      .from('investment_plans')
      .select('id,name,daily_return')
      .in('id', planIds)

    ;(plansRes.data ?? []).forEach((p: any) => {
      plansMap[p.id] = p as PlanRow
    })
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE))
  const prevHref = `/admin/payouts?page=${Math.max(
    0,
    page - 1
  )}&range=${range}${q ? `&q=${encodeURIComponent(q)}` : ''}`
  const nextHref = `/admin/payouts?page=${page + 1}&range=${range}${
    q ? `&q=${encodeURIComponent(q)}` : ''
  }`

  const mkRangeHref = (r: string) =>
    `/admin/payouts?range=${r}${q ? `&q=${encodeURIComponent(q)}` : ''}`

  return (
    <div className='mx-auto max-w-6xl p-6 space-y-6'>
      {/* Header */}
      <div className='flex items-start justify-between gap-4'>
        <div>
          <div className='flex items-center gap-2'>
            <Link href='/admin'>
              <Button variant='ghost' size='sm' className='gap-2'>
                <ArrowLeft className='h-4 w-4' />
                Back
              </Button>
            </Link>
          </div>

          <h1 className='text-3xl font-bold mt-2'>Payouts</h1>
          <p className='text-sm text-slate-600 mt-1'>
            Daily returns credited to user balances.
          </p>
        </div>

        <div className='flex gap-2'>
          <Link href='/admin/investments'>
            <Button variant='outline'>Investments</Button>
          </Link>
          <Link href='/admin/users'>
            <Button>Users</Button>
          </Link>
        </div>
      </div>

      {/* Summary */}
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
        <Card className='p-5 rounded-2xl'>
          <div className='flex items-center justify-between'>
            <div className='space-y-1'>
              <div className='text-sm text-slate-600'>Paid today</div>
              <div className='text-2xl font-bold'>{fmtNGN(todayTotal)}</div>
              <div className='text-xs text-slate-500'>
                From investment_payouts
              </div>
            </div>
            <div className='h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center'>
              <Coins className='h-5 w-5 text-slate-700' />
            </div>
          </div>
        </Card>

        <Card className='p-5 rounded-2xl'>
          <div className='flex items-center justify-between'>
            <div className='space-y-1'>
              <div className='text-sm text-slate-600'>Paid (last 7 days)</div>
              <div className='text-2xl font-bold'>{fmtNGN(weekTotal)}</div>
              <div className='text-xs text-slate-500'>Rolling 7-day total</div>
            </div>
            <div className='h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center'>
              <CalendarDays className='h-5 w-5 text-slate-700' />
            </div>
          </div>
        </Card>
      </div>

      {/* Controls */}
      <Card className='p-4 rounded-2xl'>
        <form
          action='/admin/payouts'
          className='flex flex-col md:flex-row gap-3'
        >
          <input type='hidden' name='range' value={range} />

          <div className='relative flex-1'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500' />
            <input
              name='q'
              defaultValue={q}
              placeholder='Search by email, name, user_id, investment_id...'
              className='w-full rounded-xl border bg-white px-10 py-2 text-sm outline-none'
            />
          </div>

          <div className='flex gap-2'>
            <Link href={mkRangeHref('today')}>
              <Button variant={range === 'today' ? 'default' : 'outline'}>
                Today
              </Button>
            </Link>
            <Link href={mkRangeHref('7d')}>
              <Button variant={range === '7d' ? 'default' : 'outline'}>
                7D
              </Button>
            </Link>
            <Link href={mkRangeHref('30d')}>
              <Button variant={range === '30d' ? 'default' : 'outline'}>
                30D
              </Button>
            </Link>
            <Link href={mkRangeHref('all')}>
              <Button variant={range === 'all' ? 'default' : 'outline'}>
                All
              </Button>
            </Link>
          </div>

          <Button type='submit' className='md:w-[140px]'>
            Search
          </Button>
        </form>
      </Card>

      {/* Table */}
      <Card className='rounded-2xl overflow-hidden'>
        <div className='p-4 flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <UsersIcon className='h-4 w-4 text-slate-600' />
            <div className='font-semibold'>Payout ledger</div>
            <Badge variant='secondary'>{totalCount}</Badge>
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
                <th className='p-3'>Investment</th>
                <th className='p-3'>Payout day</th>
              </tr>
            </thead>

            <tbody>
              {payouts.length === 0 ? (
                <tr>
                  <td className='p-6 text-slate-600' colSpan={5}>
                    No payouts found for this filter.
                  </td>
                </tr>
              ) : (
                payouts.map((p) => {
                  const u = usersMap[p.user_id]
                  const name =
                    `${u?.first_name ?? ''} ${u?.last_name ?? ''}`.trim() || '—'
                  const email = u?.email ?? '—'

                  const inv = invMap[p.investment_id]
                  const plan = inv?.package_id ? plansMap[inv.package_id] : null

                  const payoutDay =
                    p.payout_date ??
                    (p.created_at
                      ? new Date(p.created_at).toISOString().slice(0, 10)
                      : '—')

                  return (
                    <tr key={p.id} className='border-t'>
                      <td className='p-3'>
                        <div className='font-medium'>{name}</div>
                        <div className='text-xs text-slate-500'>{email}</div>
                        <div className='text-[11px] text-slate-400 mt-1'>
                          {p.user_id}
                        </div>

                        <div className='mt-2'>
                          <Link href={`/admin/users/${p.user_id}`}>
                            <Button variant='outline' size='sm'>
                              View user
                            </Button>
                          </Link>
                        </div>
                      </td>

                      <td className='p-3'>
                        <div className='font-medium'>{plan?.name ?? '—'}</div>
                        <div className='text-xs text-slate-500'>
                          Daily return:{' '}
                          <span className='font-medium'>
                            {fmtNGN(Number(plan?.daily_return ?? 0))}
                          </span>
                        </div>
                      </td>

                      <td className='p-3'>
                        <div className='font-semibold text-green-700'>
                          {fmtNGN(Number(p.amount ?? 0))}
                        </div>
                        <div className='text-xs text-slate-500'>credited</div>
                      </td>

                      <td className='p-3'>
                        <div className='font-medium'>
                          {safeSliceId(p.investment_id, 10)}
                        </div>
                        <div className='text-xs text-slate-500'>
                          Investment ID
                        </div>
                        <div className='mt-2'>
                          <Link
                            href={`/admin/investments?q=${encodeURIComponent(
                              String(p.investment_id)
                            )}`}
                          >
                            <Button variant='outline' size='sm'>
                              View investment
                            </Button>
                          </Link>
                        </div>
                      </td>

                      <td className='p-3'>
                        <div className='font-medium'>{payoutDay}</div>
                        <div className='text-xs text-slate-500'>
                          Created: {new Date(p.created_at).toLocaleString()}
                        </div>
                        <div className='text-[11px] text-slate-400 mt-1'>
                          {p.id}
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
