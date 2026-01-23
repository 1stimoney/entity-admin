/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import AddBalanceForm from './AddBalanceForm'

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

export default async function AdminUserDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!id) return notFound()

  // 1) Load the user
  const { data: userRow, error: userErr } = await supabaseAdmin
    .from('users')
    .select(
      'id,email,first_name,last_name,balance,created_at,avatar_url,referral_code,referred_by,points'
    )
    .eq('id', id)
    .single()

  if (userErr || !userRow) return notFound()

  // 2) Load related data
  const activeSince = daysAgoISO(30)

  const [invAllRes, invActiveRes, wdRes, trxRes] = await Promise.all([
    supabaseAdmin
      .from('investments')
      .select('id,user_id,package_id,amount,created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(200),

    supabaseAdmin
      .from('investments')
      .select('id,user_id,package_id,amount,created_at')
      .eq('user_id', id)
      .gte('created_at', activeSince)
      .order('created_at', { ascending: false })
      .limit(200),

    supabaseAdmin
      .from('withdrawals')
      .select(
        'id,user_id,email,amount,status,bank_name,account_number,account_name,flutterwave_ref,created_at,error'
      )
      .or(`user_id.eq.${id},email.eq.${userRow.email ?? ''}`)
      .order('created_at', { ascending: false })
      .limit(200),

    supabaseAdmin
      .from('transactions')
      .select(
        'id,user_id,user_email,type,amount,status,flutterwave_ref,created_at,plan_id'
      )
      .or(`user_id.eq.${id},user_email.eq.${userRow.email ?? ''}`)
      .order('created_at', { ascending: false })
      .limit(300),
  ])

  const investmentsAll = invAllRes.data || []
  const investmentsActive = invActiveRes.data || []
  const withdrawals = wdRes.data || []
  const transactions = trxRes.data || []

  const pendingWithdrawals = withdrawals.filter((w) =>
    isPendingWithdrawalStatus(w.status)
  )

  return (
    <div className='mx-auto max-w-6xl p-6 space-y-6'>
      {/* Header */}
      <div className='flex items-start justify-between gap-4'>
        <div>
          <div className='text-sm text-slate-500'>
            <Link href='/admin/users' className='hover:underline'>
              Users
            </Link>{' '}
            /{' '}
            <span className='text-slate-700 font-medium'>{userRow.email}</span>
          </div>
          <h1 className='text-3xl font-bold mt-1'>
            {userRow.first_name ?? '—'} {userRow.last_name ?? ''}
          </h1>
          <div className='text-sm text-slate-600 mt-1'>
            User ID: <span className='font-mono'>{userRow.id}</span>
          </div>
        </div>

        <div className='flex gap-2'>
          <Link href='/admin/users'>
            <Button variant='outline'>Back</Button>
          </Link>
        </div>
      </div>

      {/* Top cards */}
      <div className='grid md:grid-cols-4 gap-4'>
        <Card className='p-5 rounded-2xl'>
          <div className='text-xs text-slate-500'>Balance</div>
          <div className='text-2xl font-bold mt-1'>
            {fmtNGN(Number(userRow.balance ?? 0))}
          </div>
          <div className='text-xs text-slate-500 mt-2'>
            Joined: {new Date(userRow.created_at).toLocaleDateString()}
          </div>
        </Card>

        <Card className='p-5 rounded-2xl'>
          <div className='text-xs text-slate-500'>Investments</div>
          <div className='mt-2 flex items-center gap-2'>
            <Badge>{investmentsActive.length} active</Badge>
            <span className='text-sm text-slate-600'>
              / {investmentsAll.length} total
            </span>
          </div>
          <div className='text-xs text-slate-500 mt-2'>
            Active = last 30 days
          </div>
        </Card>

        <Card className='p-5 rounded-2xl'>
          <div className='text-xs text-slate-500'>Withdrawals</div>
          <div className='mt-2 flex items-center gap-2'>
            <span className='text-2xl font-bold'>{withdrawals.length}</span>
            {pendingWithdrawals.length > 0 ? (
              <Badge variant='destructive'>
                {pendingWithdrawals.length} pending
              </Badge>
            ) : (
              <Badge variant='secondary'>no pending</Badge>
            )}
          </div>
          <div className='text-xs text-slate-500 mt-2'>Total requests</div>
        </Card>

        <Card className='p-5 rounded-2xl'>
          <div className='text-xs text-slate-500'>Transactions</div>
          <div className='text-2xl font-bold mt-1'>{transactions.length}</div>
          <div className='text-xs text-slate-500 mt-2'>
            Includes credits/debits
          </div>
        </Card>
      </div>

      {/* Admin actions */}
      <Card className='p-5 rounded-2xl'>
        <div className='flex items-center justify-between gap-4'>
          <div>
            <div className='font-semibold'>Admin Actions</div>
            <div className='text-sm text-slate-600'>
              Add balance and log it as a transaction.
            </div>
          </div>
        </div>

        <Separator className='my-4' />

        <AddBalanceForm
          userId={userRow.id}
          userEmail={userRow.email ?? ''}
          currentBalance={Number(userRow.balance ?? 0)}
        />
      </Card>

      {/* Tabs */}
      <Tabs defaultValue='investments' className='space-y-4'>
        <TabsList>
          <TabsTrigger value='investments'>Investments</TabsTrigger>
          <TabsTrigger value='withdrawals'>Withdrawals</TabsTrigger>
          <TabsTrigger value='transactions'>Transactions</TabsTrigger>
        </TabsList>

        {/* Investments */}
        <TabsContent value='investments'>
          <Card className='rounded-2xl overflow-hidden'>
            <div className='p-4 font-semibold'>Investments</div>
            <Separator />
            <div className='p-4'>
              {investmentsAll.length === 0 ? (
                <div className='text-sm text-slate-600'>No investments.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Amount</TableHead>
                      <TableHead>Package/Plan</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Active?</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {investmentsAll.map((inv: any) => {
                      const active =
                        new Date(inv.created_at).getTime() >=
                        new Date(activeSince).getTime()

                      return (
                        <TableRow key={inv.id}>
                          <TableCell className='font-semibold'>
                            {fmtNGN(Number(inv.amount ?? 0))}
                          </TableCell>
                          <TableCell className='text-sm text-slate-600'>
                            {inv.package_id ?? inv.plan_id ?? '—'}
                          </TableCell>
                          <TableCell className='text-sm text-slate-600'>
                            {new Date(inv.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            {active ? (
                              <Badge>Active</Badge>
                            ) : (
                              <Badge variant='secondary'>Expired</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* Withdrawals */}
        <TabsContent value='withdrawals'>
          <Card className='rounded-2xl overflow-hidden'>
            <div className='p-4 font-semibold'>Withdrawals</div>
            <Separator />
            <div className='p-4'>
              {withdrawals.length === 0 ? (
                <div className='text-sm text-slate-600'>No withdrawals.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Bank</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {withdrawals.map((w: any) => (
                      <TableRow key={w.id}>
                        <TableCell className='font-semibold'>
                          {fmtNGN(Number(w.amount ?? 0))}
                        </TableCell>
                        <TableCell>
                          {isPendingWithdrawalStatus(w.status) ? (
                            <Badge variant='secondary'>{w.status}</Badge>
                          ) : (w.status || '').toLowerCase() === 'success' ||
                            (w.status || '').toLowerCase() === 'completed' ? (
                            <Badge>{w.status}</Badge>
                          ) : (w.status || '').toLowerCase() === 'failed' ? (
                            <Badge variant='destructive'>failed</Badge>
                          ) : (
                            <Badge variant='outline'>{w.status ?? '—'}</Badge>
                          )}
                        </TableCell>
                        <TableCell className='text-sm text-slate-600'>
                          {w.bank_name ?? '—'}
                        </TableCell>
                        <TableCell className='text-sm text-slate-600'>
                          <div>{w.account_name ?? ''}</div>
                          <div className='text-xs text-slate-500'>
                            {w.account_number ?? ''}
                          </div>
                        </TableCell>
                        <TableCell className='text-sm text-slate-600'>
                          {new Date(w.created_at).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* Transactions */}
        <TabsContent value='transactions'>
          <Card className='rounded-2xl overflow-hidden'>
            <div className='p-4 font-semibold'>Transactions</div>
            <Separator />
            <div className='p-4'>
              {transactions.length === 0 ? (
                <div className='text-sm text-slate-600'>No transactions.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ref</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((t: any) => (
                      <TableRow key={t.id}>
                        <TableCell className='font-medium'>
                          {t.type ?? '—'}
                        </TableCell>
                        <TableCell className='font-semibold'>
                          {fmtNGN(Number(t.amount ?? 0))}
                        </TableCell>
                        <TableCell>
                          <Badge variant='secondary'>{t.status ?? '—'}</Badge>
                        </TableCell>
                        <TableCell className='text-xs text-slate-500'>
                          {t.flutterwave_ref ?? t.provider_ref ?? '—'}
                        </TableCell>
                        <TableCell className='text-sm text-slate-600'>
                          {new Date(t.created_at).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
