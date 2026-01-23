/* eslint-disable @typescript-eslint/no-explicit-any */
// app/admin/transactions/actions/route.ts
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

function normalizePlanId(t: any) {
  return (t?.package_id ?? t?.plan_id) as string | null
}

export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const transaction_id = String(form.get('transaction_id') ?? '')
    const action = String(form.get('action') ?? '')

    if (!transaction_id || !action) {
      return NextResponse.redirect(new URL('/admin/transactions', req.url))
    }

    // Load transaction
    const { data: tx, error: txErr } = await supabaseServer
      .from('transactions')
      .select('*')
      .eq('id', transaction_id)
      .single()

    if (txErr || !tx) {
      console.error('tx load error', txErr)
      return NextResponse.redirect(new URL('/admin/transactions', req.url))
    }

    if (action === 'mark_failed') {
      // Mark tx failed
      await supabaseServer
        .from('transactions')
        .update({ status: 'failed' })
        .eq('id', transaction_id)

      // Optional: if you want, cancel linked investment too:
      // await supabaseServer
      //   .from('investments')
      //   .update({ status: 'cancelled' })
      //   .eq('source_transaction_id', transaction_id)

      return NextResponse.redirect(new URL('/admin/transactions', req.url))
    }

    if (action === 'mark_success') {
      // 1) mark tx success
      await supabaseServer
        .from('transactions')
        .update({ status: 'success' })
        .eq('id', transaction_id)

      // 2) ensure investment exists (idempotent)
      const { data: existingInv } = await supabaseServer
        .from('investments')
        .select('id')
        .eq('source_transaction_id', transaction_id)
        .maybeSingle()

      if (existingInv?.id) {
        return NextResponse.redirect(new URL('/admin/transactions', req.url))
      }

      const planId = normalizePlanId(tx)
      if (!tx.user_id || !planId) {
        console.error('tx missing user_id or plan/package id', tx)
        return NextResponse.redirect(new URL('/admin/transactions', req.url))
      }

      // Load plan (for daily_return and canonical amount)
      const { data: plan, error: planErr } = await supabaseServer
        .from('investment_plans')
        .select('id, amount, daily_return')
        .eq('id', planId)
        .single()

      if (planErr || !plan) {
        console.error('plan load error', planErr)
        return NextResponse.redirect(new URL('/admin/transactions', req.url))
      }

      const start_at = new Date()
      const end_at = new Date(start_at.getTime() + 30 * 24 * 60 * 60 * 1000)

      const { error: invErr } = await supabaseServer
        .from('investments')
        .insert({
          user_id: tx.user_id,
          package_id: plan.id,
          amount: Number(plan.amount),
          source_transaction_id: transaction_id,
          status: 'active',
          start_at: start_at.toISOString(),
          end_at: end_at.toISOString(),
          daily_return: Number(plan.daily_return ?? 0),
          last_paid_at: null,
        })

      if (invErr) {
        console.error('create investment error', invErr)
      }

      return NextResponse.redirect(new URL('/admin/transactions', req.url))
    }

    return NextResponse.redirect(new URL('/admin/transactions', req.url))
  } catch (e) {
    console.error('tx actions route error', e)
    return NextResponse.redirect(new URL('/admin/transactions', req.url))
  }
}
