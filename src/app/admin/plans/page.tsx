/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [name, setName] = useState('')
  const [amount, setAmount] = useState<number>(0)
  const [description, setDescription] = useState('')

  const load = async () => {
    setLoading(true)
    const json = await fetch('/api/admin/plans').then((r) => r.json())
    if (!json.status) toast.error(json.message || 'Failed to load plans')
    setPlans(json.data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const create = async () => {
    if (!name.trim() || !amount) return toast.error('Enter name and amount')
    const res = await fetch('/api/admin/plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), amount, description }),
    })
    const json = await res.json()
    if (!json.status) return toast.error(json.message || 'Create failed')
    toast.success('Plan created')
    setName('')
    setAmount(0)
    setDescription('')
    load()
  }

  const update = async (p: any) => {
    const res = await fetch('/api/admin/plans', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: p.id,
        name: p.name,
        amount: Number(p.amount),
        description: p.description,
      }),
    })
    const json = await res.json()
    if (!json.status) return toast.error(json.message || 'Update failed')
    toast.success('Plan updated')
    load()
  }

  const del = async (id: string) => {
    const res = await fetch('/api/admin/plans', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const json = await res.json()
    if (!json.status) return toast.error(json.message || 'Delete failed')
    toast.success('Plan deleted')
    load()
  }

  return (
    <div className='space-y-4'>
      <div>
        <div className='text-2xl font-bold'>Investment Plans</div>
        <div className='text-sm text-muted-foreground'>
          Create and manage plans shown on Invest Now.
        </div>
      </div>

      <Card className='p-4 rounded-2xl space-y-3'>
        <div className='grid md:grid-cols-3 gap-3'>
          <Input
            placeholder='Plan name'
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            type='number'
            placeholder='Amount'
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
          <Input
            placeholder='Description'
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <Button onClick={create}>Create plan</Button>
      </Card>

      {loading ? (
        <Card className='p-6 rounded-2xl'>Loading…</Card>
      ) : plans.length === 0 ? (
        <Card className='p-6 rounded-2xl'>No plans.</Card>
      ) : (
        <div className='space-y-3'>
          {plans.map((p) => (
            <Card key={p.id} className='p-4 rounded-2xl space-y-3'>
              <div className='grid md:grid-cols-3 gap-3'>
                <Input
                  value={p.name}
                  onChange={(e) => {
                    const v = e.target.value
                    setPlans((prev) =>
                      prev.map((x) => (x.id === p.id ? { ...x, name: v } : x))
                    )
                  }}
                />
                <Input
                  type='number'
                  value={p.amount}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    setPlans((prev) =>
                      prev.map((x) => (x.id === p.id ? { ...x, amount: v } : x))
                    )
                  }}
                />
                <Input
                  value={p.description ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    setPlans((prev) =>
                      prev.map((x) =>
                        x.id === p.id ? { ...x, description: v } : x
                      )
                    )
                  }}
                />
              </div>

              <div className='flex gap-2'>
                <Button onClick={() => update(p)}>Save</Button>
                <Button variant='outline' onClick={() => del(p.id)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
