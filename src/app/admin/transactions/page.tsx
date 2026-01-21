/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function AdminTransactionsPage() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  const load = async () => {
    setLoading(true)
    const json = await fetch('/api/admin/transactions').then((r) => r.json())
    if (!json.status) toast.error(json.message || 'Failed to load transactions')
    setRows(json.data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return rows
    return rows.filter((r) => JSON.stringify(r).toLowerCase().includes(s))
  }, [rows, q])

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between gap-3'>
        <div>
          <div className='text-2xl font-bold'>Transactions</div>
          <div className='text-sm text-muted-foreground'>
            All user transactions.
          </div>
        </div>
        <div className='flex gap-2'>
          <Input
            placeholder='Search…'
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className='w-80'
          />
          <Button variant='outline' onClick={load}>
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <Card className='p-6 rounded-2xl'>Loading…</Card>
      ) : visible.length === 0 ? (
        <Card className='p-6 rounded-2xl'>No transactions.</Card>
      ) : (
        <div className='space-y-3'>
          {visible.map((t) => (
            <Card key={t.id} className='p-4 rounded-2xl'>
              <div className='flex items-center justify-between'>
                <div className='font-semibold'>{t.type ?? 'transaction'}</div>
                <div className='text-sm font-semibold'>
                  ₦{Number(t.amount ?? 0).toLocaleString()}
                </div>
              </div>
              <div className='text-sm text-muted-foreground mt-1'>
                {t.user_email ?? t.email ?? '—'} • {t.status ?? '—'}
              </div>
              <div className='text-xs text-muted-foreground mt-1'>
                {t.id} •{' '}
                {t.created_at ? new Date(t.created_at).toLocaleString() : '—'}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
