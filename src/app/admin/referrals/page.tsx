'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function AdminReferralsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  const load = async () => {
    setLoading(true)
    const json = await fetch('/api/admin/referrals').then((r) => r.json())
    if (!json.status)
      toast.error(json.message || 'Failed to load referral rewards')
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

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between gap-3'>
        <div>
          <div className='text-2xl font-bold'>Referral Rewards</div>
          <div className='text-sm text-muted-foreground'>
            See credits given to referrers.
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
        <Card className='p-6 rounded-2xl'>No rewards.</Card>
      ) : (
        <div className='space-y-3'>
          {visible.map((r) => (
            <Card key={r.id} className='p-4 rounded-2xl'>
              <div className='flex items-center justify-between'>
                <div className='font-semibold'>
                  ₦{Number(r.reward_amount ?? 0).toLocaleString()}
                </div>
                <div className='text-xs text-muted-foreground'>
                  {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
                </div>
              </div>
              <div className='text-sm text-muted-foreground mt-1'>
                Referrer: {r.referrer_id} • Referred: {r.referred_user_id}
              </div>
              {r.investment_id && (
                <div className='text-xs text-muted-foreground mt-1'>
                  Investment: {r.investment_id}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
