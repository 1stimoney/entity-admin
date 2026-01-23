'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function AdminWithdrawalsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [reason, setReason] = useState('')

  const load = async () => {
    setLoading(true)
    const json = await fetch('/api/admin/withdrawals').then((r) => r.json())
    if (!json.status) toast.error(json.message || 'Failed to load withdrawals')
    setRows(json.data || [])
    setLoading(false)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [])

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return rows
    return rows.filter((r) => JSON.stringify(r).toLowerCase().includes(s))
  }, [rows, q])

  const act = async (id: string, action: 'approved' | 'failed') => {
    const res = await fetch('/api/admin/withdrawals/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        action,
        reason: action === 'failed' ? reason : undefined,
      }),
    })
    const json = await res.json()
    if (!json.status) return toast.error(json.message || 'Action failed')
    toast.success(`Withdrawal ${action}`)
    load()
  }

  return (
    <div className='space-y-4'>
      <div className='flex flex-col md:flex-row gap-3 md:items-center md:justify-between'>
        <div>
          <div className='text-2xl font-bold'>Withdrawals</div>
          <div className='text-sm text-muted-foreground'>
            Approve/deny and review withdrawal requests.
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

      <Card className='p-4 rounded-2xl'>
        <div className='text-sm font-medium mb-2'>Deny reason (optional)</div>
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder='e.g. Invalid account details'
        />
      </Card>

      {loading ? (
        <Card className='p-6 rounded-2xl'>Loading…</Card>
      ) : visible.length === 0 ? (
        <Card className='p-6 rounded-2xl'>No withdrawals.</Card>
      ) : (
        <div className='space-y-3'>
          {visible.map((w) => (
            <Card key={w.id} className='p-4 rounded-2xl'>
              <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-3'>
                <div className='min-w-0'>
                  <div className='font-semibold'>
                    ₦{Number(w.amount ?? 0).toLocaleString()} • {w.status}
                  </div>
                  <div className='text-sm text-muted-foreground truncate'>
                    {w.email} • {w.bank_name} • {w.account_number} •{' '}
                    {w.account_name}
                  </div>
                  <div className='text-xs text-muted-foreground mt-1'>
                    {w.created_at
                      ? new Date(w.created_at).toLocaleString()
                      : '—'}{' '}
                    • id: {w.id}
                  </div>
                  {w.error && (
                    <div className='text-xs text-red-600 mt-1'>
                      Note: {w.error}
                    </div>
                  )}
                </div>

                <div className='flex gap-2'>
                  <Button variant='outline' onClick={() => act(w.id, 'failed')}>
                    Deny
                  </Button>
                  <Button onClick={() => act(w.id, 'approved')}>Approve</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
