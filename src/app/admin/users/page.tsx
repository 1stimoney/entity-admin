// app/admin/users/page.tsx
import Link from 'next/link'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import {
  Search,
  Users,
  BadgeCheck,
  BadgeAlert,
  ArrowUpRight,
} from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type UserRow = {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  balance: number | null
  created_at: string
}

type InvestmentRow = {
  id: string
  user_id: string
  created_at: string
}

type WithdrawalRow = {
  id: string
  user_id: string | null
  email: string | null
  status: string | null
  created_at: string
}

type TransactionRow = {
  id: string
  user_id: string | null
  user_email: string | null
  type: string | null
  amount: number | null
  created_at: string
}

const PER_PAGE = 20

function fmtNGN(n: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(n)
}

function daysAgoISO(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

function isPendingWithdrawalStatus(status?: string | null) {
  const s = (status || '').toLowerCase()
  return ['initiated', 'processing', 'pending'].includes(s)
}

function creditType(type?: string | null) {
  const t = (type || '').toLowerCase()
  return ['balance_added', 'admin_credit', 'credit'].includes(t)
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: { q?: string; page?: string }
}) {
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

  const sp = (await searchParams) ?? {}
  const q = (sp.q ?? '').trim()
  const page = Math.max(0, Number(sp.page ?? 0))

  const from = page * PER_PAGE
  const to = from + PER_PAGE

  // 1) Load users (paged) + optional search
  let usersQuery = supabase
    .from('users')
    .select('id,email,first_name,last_name,balance,created_at', {
      count: 'exact',
    })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (q) {
    // Search across first name, last name, email
    // (PostgREST "or" syntax)
    usersQuery = usersQuery.or(
      `email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`
    )
  }

  const { data: users, count: usersCount, error: usersErr } = await usersQuery

  if (usersErr) {
    return (
      <div className='mx-auto max-w-6xl p-6'>
        <Card className='p-6 rounded-2xl'>
          <div className='font-semibold'>Failed to load users</div>
          <p className='text-sm text-slate-600 mt-1'>{usersErr.message}</p>
        </Card>
      </div>
    )
  }

  const userRows = (users || []) as UserRow[]
  const userIds = userRows.map((u) => u.id)

  // Nothing to aggregate
  if (userIds.length === 0) {
    return (
      <div className='mx-auto max-w-6xl p-6 space-y-6'>
        <Header q={q} usersCount={usersCount ?? 0} />
        <Card className='p-6 rounded-2xl text-center'>
          <div className='text-lg font-semibold'>No users found</div>
          <p className='text-sm text-slate-600 mt-1'>
            Try a different search term.
          </p>
        </Card>
      </div>
    )
  }

  // 2) Aggregates
  // Active investments = investments created within last 30 days
  const activeSince = daysAgoISO(30)

  const [invAllRes, invActiveRes, wdRes, trxRes] = await Promise.all([
    supabase
      .from('investments')
      .select('id,user_id,created_at')
      .in('user_id', userIds),
    supabase
      .from('investments')
      .select('id,user_id,created_at')
      .in('user_id', userIds)
      .gte('created_at', activeSince),
    supabase
      .from('withdrawals')
      .select('id,user_id,email,status,created_at')
      .or(`user_id.in.(${userIds.join(',')})`), // if user_id is nullable, still works for those with user_id set
    supabase
      .from('transactions')
      .select('id,user_id,user_email,type,amount,created_at')
      .in('user_id', userIds),
  ])

  // Defensive: if any table is missing / RLS blocks admin (shouldn't), still render with zeros
  const invAll = (invAllRes.data || []) as InvestmentRow[]
  const invActive = (invActiveRes.data || []) as InvestmentRow[]
  const wds = (wdRes.data || []) as WithdrawalRow[]
  const trxs = (trxRes.data || []) as TransactionRow[]

  // 3) Reduce into per-user maps
  const totalInvMap: Record<string, number> = {}
  const activeInvMap: Record<string, number> = {}
  const withdrawalsTotalMap: Record<string, number> = {}
  const withdrawalsPendingMap: Record<string, number> = {}
  const trxCountMap: Record<string, number> = {}
  const creditsSumMap: Record<string, number> = {}

  for (const r of invAll) {
    totalInvMap[r.user_id] = (totalInvMap[r.user_id] || 0) + 1
  }
  for (const r of invActive) {
    activeInvMap[r.user_id] = (activeInvMap[r.user_id] || 0) + 1
  }
  for (const w of wds) {
    if (!w.user_id) continue
    withdrawalsTotalMap[w.user_id] = (withdrawalsTotalMap[w.user_id] || 0) + 1
    if (isPendingWithdrawalStatus(w.status)) {
      withdrawalsPendingMap[w.user_id] =
        (withdrawalsPendingMap[w.user_id] || 0) + 1
    }
  }
  for (const t of trxs) {
    if (!t.user_id) continue
    trxCountMap[t.user_id] = (trxCountMap[t.user_id] || 0) + 1
    if (creditType(t.type)) {
      creditsSumMap[t.user_id] =
        (creditsSumMap[t.user_id] || 0) + Number(t.amount || 0)
    }
  }

  const totalPages = Math.ceil((usersCount ?? 0) / PER_PAGE)

  return (
    <div className='mx-auto max-w-6xl p-6 space-y-6'>
      <Header q={q} usersCount={usersCount ?? 0} />

      {/* Table */}
      <Card className='rounded-2xl overflow-hidden'>
        <div className='p-5 flex items-center justify-between gap-4'>
          <div className='flex items-center gap-2'>
            <Users className='h-5 w-5 text-slate-700' />
            <div>
              <div className='font-semibold'>Users</div>
              <div className='text-xs text-slate-500'>
                Active investments = purchased in last 30 days
              </div>
            </div>
          </div>

          <div className='flex gap-2'>
            <Link href='/admin'>
              <Button variant='outline'>Back</Button>
            </Link>
            <Link href='/admin/users?'>
              <Button variant='ghost'>Clear search</Button>
            </Link>
          </div>
        </div>

        <Separator />

        <div className='p-4'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Investments</TableHead>
                <TableHead>Withdrawals</TableHead>
                <TableHead>Transactions</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className='text-right'>Action</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {userRows.map((u) => {
                const fullName = `${u.first_name ?? ''} ${
                  u.last_name ?? ''
                }`.trim()
                const totalInv = totalInvMap[u.id] || 0
                const activeInv = activeInvMap[u.id] || 0
                const wdTotal = withdrawalsTotalMap[u.id] || 0
                const wdPending = withdrawalsPendingMap[u.id] || 0
                const trxCount = trxCountMap[u.id] || 0
                const creditsSum = creditsSumMap[u.id] || 0

                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className='min-w-0'>
                        <div className='font-medium truncate'>
                          {fullName || '—'}
                        </div>
                        <div className='text-xs text-slate-500 truncate'>
                          {u.email ?? '—'}
                        </div>
                        <div className='text-[11px] text-slate-400 truncate'>
                          ID: {u.id}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className='font-semibold'>
                      {fmtNGN(Number(u.balance ?? 0))}
                    </TableCell>

                    <TableCell>
                      <div className='flex flex-col gap-1'>
                        <div className='flex items-center gap-2'>
                          <Badge
                            variant={activeInv > 0 ? 'default' : 'secondary'}
                          >
                            {activeInv} active
                          </Badge>
                          <span className='text-xs text-slate-500'>
                            / {totalInv} total
                          </span>
                        </div>
                        <span className='text-xs text-slate-500'>
                          Active window: 30 days
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className='flex flex-col gap-1'>
                        <div className='flex items-center gap-2'>
                          <span className='text-sm font-medium'>
                            {wdTotal} total
                          </span>
                          {wdPending > 0 ? (
                            <Badge variant='destructive' className='gap-1'>
                              <BadgeAlert className='h-3.5 w-3.5' />
                              {wdPending} pending
                            </Badge>
                          ) : (
                            <Badge variant='secondary' className='gap-1'>
                              <BadgeCheck className='h-3.5 w-3.5' />
                              none pending
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className='flex flex-col gap-1'>
                        <div className='text-sm font-medium'>
                          {trxCount} total
                        </div>
                        <div className='text-xs text-slate-500'>
                          Credits added:{' '}
                          <span className='font-medium text-slate-700'>
                            {fmtNGN(creditsSum)}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className='text-sm text-slate-600'>
                      {new Date(u.created_at).toLocaleDateString()}
                    </TableCell>

                    <TableCell className='text-right'>
                      <Link href={`/admin/users/${u.id}`}>
                        <Button size='sm' className='gap-2'>
                          View <ArrowUpRight className='h-4 w-4' />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        <Separator />

        {/* Pagination */}
        <div className='p-4 flex items-center justify-between'>
          <div className='text-sm text-slate-600'>
            Page <span className='font-medium'>{page + 1}</span>{' '}
            {totalPages ? `of ${totalPages}` : ''}
          </div>

          <div className='flex gap-2'>
            <Link
              href={`/admin/users?q=${encodeURIComponent(q)}&page=${Math.max(
                0,
                page - 1
              )}`}
            >
              <Button variant='outline' disabled={page === 0}>
                Previous
              </Button>
            </Link>
            <Link
              href={`/admin/users?q=${encodeURIComponent(q)}&page=${page + 1}`}
            >
              <Button
                variant='outline'
                disabled={usersCount !== null && to + 1 >= (usersCount ?? 0)}
              >
                Next
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      <Card className='p-4 rounded-2xl'>
        <div className='text-sm text-slate-600'>
          ✅ This table uses: <span className='font-medium'>investments</span>,{' '}
          <span className='font-medium'>withdrawals</span>,{' '}
          <span className='font-medium'>transactions</span>. <br />
          If your “balance added” rows use a different <code>type</code> value,
          tell me what it is and I’ll update the filter.
        </div>
      </Card>
    </div>
  )
}

function Header({ q, usersCount }: { q: string; usersCount: number }) {
  return (
    <div className='flex flex-col gap-3 md:flex-row md:items-end md:justify-between'>
      <div>
        <h1 className='text-3xl font-bold'>Users</h1>
        <p className='text-sm text-slate-600 mt-1'>
          Admin view of users with active investments, withdrawals and
          transactions.
        </p>
      </div>

      <form className='flex items-center gap-2'>
        <div className='relative w-full md:w-96'>
          <Search className='h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2' />
          <Input
            name='q'
            defaultValue={q}
            placeholder='Search by name or email...'
            className='pl-10'
          />
        </div>
        <Button type='submit'>Search</Button>
        <Badge variant='secondary' className='hidden md:inline-flex'>
          {usersCount} users
        </Badge>
      </form>
    </div>
  )
}
