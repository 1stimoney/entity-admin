/* eslint-disable @typescript-eslint/no-explicit-any */
// app/admin/investments/page.tsx
import Link from 'next/link'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import {
  ArrowLeft,
  Search,
  Layers,
  Timer,
  User as UserIcon,
} from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

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
}

type PlanRow = {
  id: string
  name: string | null
  amount: number | null
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

function addDays(dateIso: string, days: number) {
  const d = new Date(dateIso)
  d.setDate(d.getDate() + days)
  return d
}

function daysLeft(createdAtIso: string, days: number) {
  const expiry = addDays(createdAtIso, days).getTime()
  const now = Date.now()
  const diff = expiry - now
  if (diff <= 0) return 0
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function isActive(createdAtIso: string, days: number, status?: string | null) {
  const s = (status ?? '').toLowerCase()
  if (['cancelled', 'canceled', 'failed', 'error'].includes(s)) return false
  return Date.now() < addDays(createdAtIso, days).getTime()
}

function statusVariant(status?: string | null) {
  const s = (status ?? '').toLowerCase()
  if (['active', 'running', 'success', 'successful', 'completed'].includes(s))
    return 'default'
  if (['cancelled', 'canceled', 'failed', 'error'].includes(s))
    return 'destructive'
  return 'secondary'
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

  // ---------- Load investments ----------
  const from = page * PER_PAGE
  const to = from + PER_PAGE - 1

  // If you have a ton of rows later, consider a SQL view that joins users + plans.
  const invRes = await supabase
    .from('investments')
    .select(
      'id,created_at,amount,package_id,user_id,status,source_transaction_id',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, to)

  const investments = (invRes.data ?? []) as InvestmentRow[]
  const totalCount = invRes.count ?? 0

  // ---------- Load referenced users & plans ----------
  const userIds = Array.from(new Set(investments.map((i) => i.user_id)))
  const planIds = Array.from(new Set(investments.map((i) => i.package_id)))

  const [usersRes, plansRes] = await Promise.all([
    userIds.length
      ? supabase
          .from('users')
          .select('id,email,first_name,last_name')
          .in('id', userIds)
      : Promise.resolve({ data: [] as any[] }),
    planIds.length
      ? supabase
          .from('investment_plans')
          .select('id,name,amount')
          .in('id', planIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const usersMap: Record<string, UserRow> = {}
  ;(usersRes.data ?? []).forEach((u: any) => (usersMap[u.id] = u as UserRow))

  const plansMap: Record<string, PlanRow> = {}
  ;(plansRes.data ?? []).forEach((p: any) => (plansMap[p.id] = p as PlanRow))

  // ---------- Client-side search + tab filter (on loaded page) ----------
  // For large datasets you’d implement server-side filtering (SQL view/RPC).
  const visible = investments.filter((inv) => {
    const u = usersMap[inv.user_id]
    const p = plansMap[inv.package_id]

    const fullName = `${u?.first_name ?? ''} ${u?.last_name ?? ''}`.trim()
    const email = (u?.email ?? '').toLowerCase()
    const planName = (p?.name ?? '').toLowerCase()

    const active = isActive(inv.created_at, VALIDITY_DAYS, inv.status)

    if (tab === 'active' && !active) return false
    if (tab === 'expired' && active) return false

    if (!q) return true

    const qLower = q.toLowerCase()
    return (
      inv.id.toLowerCase().includes(qLower) ||
      inv.user_id.toLowerCase().includes(qLower) ||
      inv.package_id.toLowerCase().includes(qLower) ||
      (inv.source_transaction_id ?? '').toLowerCase().includes(qLower) ||
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
    <div className='mx-auto max-w-6xl p-6 space-y-6'>
      {/* Header */}
      <div className='flex items-start justify-between gap-4'>
        <div>
          <Link href='/admin'>
            <Button variant='ghost' size='sm' className='gap-2'>
              <ArrowLeft className='h-4 w-4' />
              Back
            </Button>
          </Link>

          <h1 className='text-3xl font-bold mt-2'>Investments</h1>
          <p className='text-sm text-slate-600 mt-1'>
            View all investments, who owns them, and whether they’re still
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
                <th className='p-3'>Status</th>
                <th className='p-3'>Created</th>
              </tr>
            </thead>

            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td className='p-6 text-slate-600' colSpan={6}>
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
                  const active = isActive(
                    inv.created_at,
                    VALIDITY_DAYS,
                    inv.status
                  )
                  const left = daysLeft(inv.created_at, VALIDITY_DAYS)
                  const expires = addDays(inv.created_at, VALIDITY_DAYS)

                  return (
                    <tr key={inv.id} className='border-t align-top'>
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

                            <div className='mt-2'>
                              <Link href={`/admin/users/${inv.user_id}`}>
                                <Button size='sm' variant='outline'>
                                  View user
                                </Button>
                              </Link>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Plan */}
                      <td className='p-3'>
                        <div className='font-medium'>{planName}</div>
                        <div className='text-xs text-slate-500'>
                          Plan ID: {inv.package_id.slice(0, 10)}…
                        </div>
                      </td>

                      {/* Amount */}
                      <td className='p-3'>
                        <div className='font-semibold text-slate-900'>
                          {fmtNGN(Number(inv.amount ?? p?.amount ?? 0))}
                        </div>
                        <div className='text-xs text-slate-500'>
                          Source Tx:{' '}
                          {inv.source_transaction_id
                            ? inv.source_transaction_id.slice(0, 10) + '…'
                            : '—'}
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
                          {active ? (
                            <>
                              Days left:{' '}
                              <span className='font-medium text-slate-800'>
                                {left}
                              </span>
                            </>
                          ) : (
                            <>
                              Expired on:{' '}
                              <span className='font-medium text-slate-800'>
                                {expires.toLocaleDateString()}
                              </span>
                            </>
                          )}
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
                          ID: {String(inv.id).slice(0, 10)}…
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
