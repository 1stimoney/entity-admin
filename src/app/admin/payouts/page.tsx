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

  // ---- summary: today + last 7 days ----
  // (simple aggregate using select + sum in Node; fine for admin scale)
  const [todayAgg, weekAgg] = await Promise.all([
    supabase
      .from('investment_payouts')
      .select('amount,created_at')
      .gte('created_at', daysAgoISO(0)),
    supabase
      .from('investment_payouts')
      .select('amount,created_at')
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

  // ---- main query ----
  const from = page * PER_PAGE
  const to = from + PER_PAGE - 1

  // base query
  let payoutsQuery = supabase
    .from('investment_payouts')
    .select('id,created_at,amount,user_id,investment_id', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (fromISO) payoutsQuery = payoutsQuery.gte('created_at', fromISO)

  // Search (safe + simple): match on user_id or investment_id by exact,
  // and email/name via a second pass (fetch users matching q).
  // If q looks like a uuid-ish, we can filter directly.
  const looksUuid = /^[0-9a-fA-F-]{8,}$/.test(q)
  if (q && looksUuid) {
    payoutsQuery = payoutsQuery.or(`user_id.eq.${q},investment_id.eq.${q}`)
  }

  // fetch payouts page
  const payoutsRes = await payoutsQuery.range(from, to)
  const payouts = (payoutsRes.data ?? []) as PayoutRow[]
  const totalCount = payoutsRes.count ?? 0

  // load users for those payout rows
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

  // If q is NOT uuid-ish, try to filter by user email/name:
  // We do this by finding user IDs that match q, then filtering payouts client-side
  // (within the fetched page). For large datasets you’d do this with a view/RPC.
  let visiblePayouts = payouts
  if (q && !looksUuid) {
    const qLower = q.toLowerCase()
    visiblePayouts = payouts.filter((p) => {
      const u = usersMap[p.user_id]
      const name = `${u?.first_name ?? ''} ${u?.last_name ?? ''}`.trim()
      const email = (u?.email ?? '').toLowerCase()
      return (
        email.includes(qLower) ||
        name.toLowerCase().includes(qLower) ||
        p.investment_id.toLowerCase().includes(qLower) ||
        p.user_id.toLowerCase().includes(qLower)
      )
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
                <th className='p-3'>Amount</th>
                <th className='p-3'>Investment</th>
                <th className='p-3'>Date</th>
              </tr>
            </thead>

            <tbody>
              {visiblePayouts.length === 0 ? (
                <tr>
                  <td className='p-6 text-slate-600' colSpan={4}>
                    No payouts found for this filter.
                  </td>
                </tr>
              ) : (
                visiblePayouts.map((p) => {
                  const u = usersMap[p.user_id]
                  const name =
                    `${u?.first_name ?? ''} ${u?.last_name ?? ''}`.trim() || '—'
                  const email = u?.email ?? '—'

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
                        <div className='font-semibold text-green-700'>
                          {fmtNGN(Number(p.amount ?? 0))}
                        </div>
                        <div className='text-xs text-slate-500'>credited</div>
                      </td>

                      <td className='p-3'>
                        <div className='font-medium'>
                          {p.investment_id.slice(0, 10)}…
                        </div>
                        <div className='text-xs text-slate-500'>
                          Investment ID
                        </div>
                      </td>

                      <td className='p-3'>
                        <div className='font-medium'>
                          {new Date(p.created_at).toLocaleString()}
                        </div>
                        <div className='text-xs text-slate-500'>{p.id}</div>
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
