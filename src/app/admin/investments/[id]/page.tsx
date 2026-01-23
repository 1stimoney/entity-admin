// app/admin/investments/[id]/page.tsx
import Link from 'next/link'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import {
  ArrowLeft,
  User as UserIcon,
  Layers,
  Timer,
  ReceiptText,
  Wallet,
} from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { supabase } from '@/lib/supabases'

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

type UserRow = {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  balance: number | null
  role?: string | null
}

type PlanRow = {
  id: string
  name: string | null
  amount: number | null
  description: string | null
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

export default async function AdminInvestmentDetailPage(props: {
  params: Promise<{ id: string }>
}) {
  const { id } = await props.params

  // 1) Fetch investment
  const invRes = await supabase
    .from('investments')
    .select(
      'id,created_at,amount,package_id,user_id,status,source_transaction_id'
    )
    .eq('id', id)
    .single()

  const investment = invRes.data as InvestmentRow | null

  if (!investment) {
    return (
      <div className='mx-auto max-w-3xl p-6 space-y-4'>
        <Link href='/admin/investments'>
          <Button variant='ghost' size='sm' className='gap-2'>
            <ArrowLeft className='h-4 w-4' />
            Back
          </Button>
        </Link>

        <Card className='p-6 rounded-2xl'>
          <h1 className='text-xl font-bold'>Investment not found</h1>
          <p className='text-sm text-slate-600 mt-2'>
            This investment ID doesn’t exist or you don’t have access.
          </p>
        </Card>
      </div>
    )
  }

  // 2) Fetch user + plan
  const [userRes, planRes] = await Promise.all([
    supabase
      .from('users')
      .select('id,email,first_name,last_name,balance,role')
      .eq('id', investment.user_id)
      .single(),
    supabase
      .from('investment_plans')
      .select('id,name,amount,description')
      .eq('id', investment.package_id)
      .single(),
  ])

  const user = userRes.data as UserRow | null
  const plan = planRes.data as PlanRow | null

  const active = isActive(
    investment.created_at,
    VALIDITY_DAYS,
    investment.status
  )
  const left = daysLeft(investment.created_at, VALIDITY_DAYS)
  const expiresOn = addDays(investment.created_at, VALIDITY_DAYS)

  const userName =
    `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || '—'
  const userEmail = user?.email ?? '—'
  const planName = plan?.name ?? 'Unknown plan'
  const planAmount = Number(plan?.amount ?? 0)
  const invAmount = Number(investment.amount ?? 0)

  return (
    <div className='mx-auto max-w-5xl p-6 space-y-6'>
      {/* Header */}
      <div className='flex items-start justify-between gap-4'>
        <div className='space-y-2'>
          <Link href='/admin/investments'>
            <Button variant='ghost' size='sm' className='gap-2'>
              <ArrowLeft className='h-4 w-4' />
              Back to investments
            </Button>
          </Link>

          <div>
            <h1 className='text-3xl font-bold'>Investment Details</h1>
            <p className='text-sm text-slate-600 mt-1'>
              Investment ID:{' '}
              <span className='font-medium'>{investment.id}</span>
            </p>
          </div>
        </div>

        <div className='flex flex-wrap gap-2'>
          <Link href={`/admin/users/${investment.user_id}`}>
            <Button variant='outline'>View user</Button>
          </Link>
          <Link href='/admin/transactions'>
            <Button variant='outline'>Transactions</Button>
          </Link>
          <Link href='/admin/withdrawals'>
            <Button variant='outline'>Withdrawals</Button>
          </Link>
        </div>
      </div>

      {/* Top summary cards */}
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-4'>
        {/* User */}
        <Card className='p-5 rounded-2xl'>
          <div className='flex items-center justify-between'>
            <div className='space-y-1'>
              <div className='text-sm text-slate-600'>User</div>
              <div className='text-xl font-bold truncate'>{userName}</div>
              <div className='text-sm text-slate-600 truncate'>{userEmail}</div>
            </div>
            <div className='h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center'>
              <UserIcon className='h-5 w-5 text-slate-700' />
            </div>
          </div>

          <Separator className='my-4' />

          <div className='flex items-center justify-between text-sm'>
            <span className='text-slate-600'>Balance</span>
            <span className='font-semibold'>
              {fmtNGN(Number(user?.balance ?? 0))}
            </span>
          </div>

          <div className='mt-3'>
            <Link href={`/admin/users/${investment.user_id}`}>
              <Button size='sm' variant='outline'>
                Go to user profile
              </Button>
            </Link>
          </div>
        </Card>

        {/* Plan */}
        <Card className='p-5 rounded-2xl'>
          <div className='flex items-center justify-between'>
            <div className='space-y-1'>
              <div className='text-sm text-slate-600'>Plan</div>
              <div className='text-xl font-bold truncate'>{planName}</div>
              <div className='text-sm text-slate-600'>
                Plan price:{' '}
                <span className='font-medium'>{fmtNGN(planAmount)}</span>
              </div>
            </div>
            <div className='h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center'>
              <Layers className='h-5 w-5 text-slate-700' />
            </div>
          </div>

          <Separator className='my-4' />

          <div className='text-sm text-slate-600'>
            {plan?.description ? plan.description : '—'}
          </div>
        </Card>

        {/* Validity */}
        <Card className='p-5 rounded-2xl'>
          <div className='flex items-center justify-between'>
            <div className='space-y-1'>
              <div className='text-sm text-slate-600'>Validity</div>
              <div className='text-xl font-bold'>
                {active ? 'Active' : 'Expired'}
              </div>
              <div className='text-sm text-slate-600'>
                {active ? (
                  <>
                    Days left:{' '}
                    <span className='font-medium text-slate-900'>{left}</span>
                  </>
                ) : (
                  <>
                    Expired on:{' '}
                    <span className='font-medium text-slate-900'>
                      {expiresOn.toLocaleDateString()}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className='h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center'>
              <Timer className='h-5 w-5 text-slate-700' />
            </div>
          </div>

          <Separator className='my-4' />

          <div className='flex items-center justify-between'>
            <span className='text-sm text-slate-600'>Investment status</span>
            <Badge variant={statusVariant(investment.status)}>
              {investment.status ?? 'pending'}
            </Badge>
          </div>
        </Card>
      </div>

      {/* Details */}
      <Card className='p-6 rounded-2xl'>
        <div className='flex items-center justify-between gap-3'>
          <div>
            <h2 className='text-lg font-semibold'>Investment info</h2>
            <p className='text-sm text-slate-600'>
              Raw fields from the investments table.
            </p>
          </div>
        </div>

        <Separator className='my-4' />

        <div className='grid grid-cols-1 md:grid-cols-2 gap-4 text-sm'>
          <div className='rounded-xl border bg-white p-4'>
            <div className='text-slate-600'>Amount</div>
            <div className='text-lg font-semibold'>{fmtNGN(invAmount)}</div>
          </div>

          <div className='rounded-xl border bg-white p-4'>
            <div className='text-slate-600'>Created at</div>
            <div className='font-medium'>
              {new Date(investment.created_at).toLocaleString()}
            </div>
          </div>

          <div className='rounded-xl border bg-white p-4'>
            <div className='text-slate-600'>User ID</div>
            <div className='font-medium break-all'>{investment.user_id}</div>
          </div>

          <div className='rounded-xl border bg-white p-4'>
            <div className='text-slate-600'>Plan/Package ID</div>
            <div className='font-medium break-all'>{investment.package_id}</div>
          </div>

          <div className='rounded-xl border bg-white p-4 md:col-span-2'>
            <div className='text-slate-600'>Source transaction</div>
            <div className='font-medium break-all'>
              {investment.source_transaction_id ?? '—'}
            </div>
          </div>
        </div>

        <Separator className='my-6' />

        {/* Quick actions */}
        <div className='flex flex-wrap gap-2'>
          <Link href='/admin/transactions'>
            <Button variant='outline' className='gap-2'>
              <ReceiptText className='h-4 w-4' />
              View transactions
            </Button>
          </Link>
          <Link href='/admin/withdrawals'>
            <Button variant='outline' className='gap-2'>
              <Wallet className='h-4 w-4' />
              View withdrawals
            </Button>
          </Link>
          <Link href={`/admin/users/${investment.user_id}`}>
            <Button className='gap-2'>
              <UserIcon className='h-4 w-4' />
              Open user
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}
