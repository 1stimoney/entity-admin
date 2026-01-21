'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function AddBalanceForm({
  userId,
  userEmail,
  currentBalance,
}: {
  userId: string
  userEmail: string
  currentBalance: number
}) {
  const [amount, setAmount] = useState<number | ''>('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!amount || Number(amount) <= 0)
      return toast.error('Enter a valid amount.')

    try {
      setLoading(true)
      const res = await fetch('/api/admin/users/credit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          user_email: userEmail,
          amount: Number(amount),
          note,
        }),
      })

      const json = await res.json()
      if (!json.status) {
        toast.error(json.message || 'Failed to add balance.')
        return
      }

      toast.success('Balance credited successfully.')
      // simplest refresh
      window.location.reload()
    } catch (e) {
      console.error(e)
      toast.error('Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='grid md:grid-cols-3 gap-3 items-end'>
      <div className='md:col-span-1'>
        <label className='text-sm font-medium'>Amount (₦)</label>
        <Input
          type='number'
          value={amount}
          onChange={(e) =>
            setAmount(e.target.value === '' ? '' : Number(e.target.value))
          }
          placeholder='2000'
        />
        <div className='text-xs text-slate-500 mt-1'>
          Current balance: ₦{currentBalance.toLocaleString()}
        </div>
      </div>

      <div className='md:col-span-2'>
        <label className='text-sm font-medium'>Note (optional)</label>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder='e.g. ROI payout, manual credit, referral payout...'
        />
      </div>

      <div className='md:col-span-3'>
        <Button onClick={submit} disabled={loading} className='w-full'>
          {loading ? 'Crediting...' : 'Add Balance'}
        </Button>
      </div>
    </div>
  )
}
