/* eslint-disable @typescript-eslint/no-explicit-any */
// app/admin/transactions/page.tsx
import Link from 'next/link'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import {
  ArrowLeft,
  Search,
  ReceiptText,
  BadgeCheck,
  BadgeX,
  Link2,
  ExternalLink,
} from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

const PER_PAGE = 20

type TxRow = {
  id: string
  created_at: string
  user_id?: string | null
  user_email?: string | null
  amount?: number | null
  status?: string | null
  flutterwave_ref?: string | null

  // optional columns (may not exist in your schema)
  plan_id?: string | null
  package_id?: string | null
  type?: string | null
  provider_transaction_id?: string | null
  provider_ref?: string | null
}

type InvestmentRow = {
  id: string
  user_id: string
  package_id: string
  amount: number | null
  source_transaction_id: string | null
  status: string | null
  created_at: string
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

function safeId(id: any) {
  const s = String(id ?? '')
  return s.length > 10 ? `${s.slice(0, 10)}…` : s
}

function badgeVariant(status?: string | null) {
  const s = (status ?? '').toLowerCase()
  if (['success', 'successful', 'completed', 'paid'].includes(s))
    return 'default'
  if (['failed', 'error', 'cancelled', 'canceled'].includes(s))
    return 'destructive'
  return 'secondary'
}

function normalizeTxStatus(s?: string | null) {
  const v = (s ?? '').toLowerCase()
  if (['success', 'successful', 'paid', 'completed'].includes(v))
    return 'success'
  if (['failed', 'error', 'cancelled', 'canceled'].includes(v)) return 'failed'
  return 'pending'
}

export default async function AdminTransactionsPage(props: {
  searchParams?: Promise<{
    q?: string
    page?: string
    status?: 'all' | 'pending' | 'success' | 'failed'
  }>
}) {
  const searchParams = (await props.searchParams) ?? {}
  const q = (searchParams.q ?? '').trim()
  const status = (searchParams.status ?? 'all') as
    | 'all'
    | 'pending'
    | 'success'
    | 'failed'
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

  const from = page * PER_PAGE
  const to = from + PER_PAGE - 1

  // ✅ Use select('*') so missing columns never break the page
  let txQuery = supabase
    .from('transactions')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (status !== 'all') {
    if (status === 'success')
      txQuery = txQuery.in('status', [
        'success',
        'successful',
        'paid',
        'completed',
      ])
    if (status === 'failed')
      txQuery = txQuery.in('status', [
        'failed',
        'error',
        'cancelled',
        'canceled',
      ])
    if (status === 'pending')
      txQuery = txQuery.in('status', ['pending', 'initiated', 'processing'])
  }

  const txRes = await txQuery.range(from, to)

  if (txRes.error) {
    return (
      <div className='mx-auto max-w-6xl p-6 space-y-4'>
        <h1 className='text-2xl font-bold'>Transactions</h1>
        <Card className='p-4 rounded-2xl'>
          <div className='text-red-600 font-medium'>Query failed</div>
          <div className='text-sm text-slate-600 mt-2'>
            {txRes.error.message}
          </div>
          <div className='text-xs text-slate-500 mt-2'>
            Fix: check your <code>transactions</code> table columns + RLS for
            admin.
          </div>
        </Card>
      </div>
    )
  }

  const transactions = (txRes.data ?? []) as TxRow[]
  const totalCount = txRes.count ?? 0

  // ---- Linked investments by source_transaction_id ----
  const txIds = Array.from(new Set(transactions.map((t) => String(t.id))))

  const invMap: Record<string, InvestmentRow> = {}
  if (txIds.length) {
    const invRes = await supabase
      .from('investments')
      .select(
        'id,user_id,package_id,amount,source_transaction_id,status,created_at'
      )
      .in('source_transaction_id', txIds)

    ;(invRes.data ?? []).forEach((inv: any) => {
      if (inv.source_transaction_id)
        invMap[String(inv.source_transaction_id)] = inv as InvestmentRow
    })
  }

  // ---- Plans (optional) ----
  const planIds = Array.from(
    new Set(
      transactions
        .map((t: any) => (t.package_id ?? t.plan_id) as string | null)
        .filter(Boolean) as string[]
    )
  )

  const plansMap: Record<string, PlanRow> = {}
  if (planIds.length) {
    const plansRes = await supabase
      .from('investment_plans')
      .select('id,name,daily_return')
      .in('id', planIds)

    ;(plansRes.data ?? []).forEach((p: any) => (plansMap[p.id] = p as PlanRow))
  }

  // ---- Search on loaded page ----
  const visible = transactions.filter((t: any) => {
    if (!q) return true
    const ql = q.toLowerCase()
    const planKey = String(t.package_id ?? t.plan_id ?? '')
    const planName = (plansMap[planKey]?.name ?? '').toLowerCase()
    const inv = invMap[String(t.id)]

    return (
      String(t.id ?? '')
        .toLowerCase()
        .includes(ql) ||
      String(t.user_id ?? '')
        .toLowerCase()
        .includes(ql) ||
      String(t.user_email ?? '')
        .toLowerCase()
        .includes(ql) ||
      String(t.flutterwave_ref ?? '')
        .toLowerCase()
        .includes(ql) ||
      String(planKey).toLowerCase().includes(ql) ||
      planName.includes(ql) ||
      String(inv?.id ?? '')
        .toLowerCase()
        .includes(ql)
    )
  })

  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE))
  const baseQs = `status=${status}${q ? `&q=${encodeURIComponent(q)}` : ''}`

  const prevHref = `/admin/transactions?page=${Math.max(0, page - 1)}&${baseQs}`
  const nextHref = `/admin/transactions?page=${page + 1}&${baseQs}`

  const statusHref = (s: 'all' | 'pending' | 'success' | 'failed') =>
    `/admin/transactions?status=${s}${q ? `&q=${encodeURIComponent(q)}` : ''}`

  return (
    <div className='mx-auto max-w-7xl p-6 space-y-6'>
      {/* Header */}
      <div className='flex items-start justify-between gap-4'>
        <div>
          <Link href='/admin'>
            <Button variant='ghost' size='sm' className='gap-2'>
              <ArrowLeft className='h-4 w-4' />
              Back
            </Button>
          </Link>

          <h1 className='text-3xl font-bold mt-2'>Transactions</h1>
          <p className='text-sm text-slate-600 mt-1'>
            Mark payments as success/failed and see the linked investment (if
            created).
          </p>
        </div>

        <div className='flex gap-2'>
          <Link href='/admin/investments'>
            <Button variant='outline'>Investments</Button>
          </Link>
          <Link href='/admin/payouts'>
            <Button>Payouts</Button>
          </Link>
        </div>
      </div>

      {/* Controls */}
      <Card className='p-4 rounded-2xl'>
        <form
          action='/admin/transactions'
          className='flex flex-col md:flex-row gap-3'
        >
          <input type='hidden' name='status' value={status} />
          <div className='relative flex-1'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500' />
            <input
              name='q'
              defaultValue={q}
              placeholder='Search by email, tx id, flutterwave ref, investment id...'
              className='w-full rounded-xl border bg-white px-10 py-2 text-sm outline-none'
            />
          </div>
          <Button type='submit' className='md:w-[140px]'>
            Search
          </Button>
        </form>

        <div className='mt-3 flex flex-wrap gap-2'>
          <Link href={statusHref('all')}>
            <Button
              variant={status === 'all' ? 'default' : 'outline'}
              size='sm'
            >
              All
            </Button>
          </Link>
          <Link href={statusHref('pending')}>
            <Button
              variant={status === 'pending' ? 'default' : 'outline'}
              size='sm'
            >
              Pending
            </Button>
          </Link>
          <Link href={statusHref('success')}>
            <Button
              variant={status === 'success' ? 'default' : 'outline'}
              size='sm'
            >
              Success
            </Button>
          </Link>
          <Link href={statusHref('failed')}>
            <Button
              variant={status === 'failed' ? 'default' : 'outline'}
              size='sm'
            >
              Failed
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
            <ReceiptText className='h-4 w-4 text-slate-600' />
            <div className='font-semibold'>Transactions list</div>
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
                <th className='p-3'>Refs</th>
                <th className='p-3'>Linked investment</th>
                <th className='p-3'>Status</th>
                <th className='p-3'>Actions</th>
              </tr>
            </thead>

            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td className='p-6 text-slate-600' colSpan={7}>
                    No transactions found for this filter.
                  </td>
                </tr>
              ) : (
                visible.map((t: any) => {
                  const planKey = String(t.package_id ?? t.plan_id ?? '')
                  const plan = plansMap[planKey]
                  const inv = invMap[String(t.id)]
                  const txStatus = normalizeTxStatus(t.status)

                  return (
                    <tr key={t.id} className='border-t align-top'>
                      <td className='p-3'>
                        <div className='font-medium'>{t.user_email ?? '—'}</div>
                        <div className='text-xs text-slate-500 mt-1'>
                          User ID: {safeId(t.user_id)}
                        </div>
                        {t.user_id ? (
                          <div className='mt-2'>
                            <Link href={`/admin/users/${t.user_id}`}>
                              <Button size='sm' variant='outline'>
                                View user
                              </Button>
                            </Link>
                          </div>
                        ) : null}
                      </td>

                      <td className='p-3'>
                        <div className='font-medium'>{plan?.name ?? '—'}</div>
                        <div className='text-xs text-slate-500 mt-1'>
                          Plan ID: {planKey ? safeId(planKey) : '—'}
                        </div>
                        <div className='text-xs text-slate-500 mt-1'>
                          Daily return:{' '}
                          <span className='font-medium text-slate-800'>
                            {fmtNGN(Number(plan?.daily_return ?? 0))}
                          </span>
                        </div>
                      </td>

                      <td className='p-3'>
                        <div className='font-semibold text-slate-900'>
                          {fmtNGN(Number(t.amount ?? 0))}
                        </div>
                        <div className='text-xs text-slate-500 mt-1'>
                          Tx: {safeId(t.id)}
                        </div>
                      </td>

                      <td className='p-3'>
                        <div className='text-xs text-slate-600'>
                          FW ref:{' '}
                          <span className='font-medium'>
                            {t.flutterwave_ref ?? '—'}
                          </span>
                        </div>
                        <div className='text-xs text-slate-500 mt-2'>
                          {new Date(t.created_at).toLocaleString()}
                        </div>
                      </td>

                      <td className='p-3'>
                        {inv ? (
                          <div className='space-y-2'>
                            <div className='flex items-center gap-2'>
                              <Link2 className='h-4 w-4 text-slate-600' />
                              <div className='font-medium'>Linked</div>
                              <Badge variant={badgeVariant(inv.status)}>
                                {inv.status ?? 'active'}
                              </Badge>
                            </div>
                            <div className='text-xs text-slate-500'>
                              Investment:{' '}
                              <span className='font-medium'>
                                {safeId(inv.id)}
                              </span>
                            </div>
                            <Link
                              href={`/admin/investments?q=${encodeURIComponent(
                                inv.id
                              )}`}
                            >
                              <Button
                                size='sm'
                                variant='outline'
                                className='gap-2'
                              >
                                View investment{' '}
                                <ExternalLink className='h-4 w-4' />
                              </Button>
                            </Link>
                          </div>
                        ) : (
                          <div className='text-sm text-slate-600'>
                            No investment created yet.
                            <div className='text-xs text-slate-500 mt-1'>
                              Mark as success to auto-create.
                            </div>
                          </div>
                        )}
                      </td>

                      <td className='p-3'>
                        <Badge variant={badgeVariant(t.status)}>
                          {t.status ?? 'pending'}
                        </Badge>
                      </td>

                      <td className='p-3'>
                        <div className='flex flex-col gap-2'>
                          <form
                            action='../api/admin/transactions/actions'
                            method='POST'
                          >
                            <input
                              type='hidden'
                              name='transaction_id'
                              value={t.id}
                            />
                            <input
                              type='hidden'
                              name='action'
                              value='mark_success'
                            />
                            <Button
                              size='sm'
                              className='w-full gap-2'
                              disabled={txStatus === 'success'}
                            >
                              <BadgeCheck className='h-4 w-4' />
                              Mark success
                            </Button>
                          </form>

                          <form
                            action='../api/admin/transactions/actions'
                            method='POST'
                          >
                            <input
                              type='hidden'
                              name='transaction_id'
                              value={t.id}
                            />
                            <input
                              type='hidden'
                              name='action'
                              value='mark_failed'
                            />
                            <Button
                              size='sm'
                              variant='destructive'
                              className='w-full gap-2'
                              disabled={txStatus === 'failed'}
                            >
                              <BadgeX className='h-4 w-4' />
                              Mark failed
                            </Button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

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
