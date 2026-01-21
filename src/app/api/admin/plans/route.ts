import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('investment_plans')
    .select('*')
    .order('amount', { ascending: true })

  if (error)
    return NextResponse.json(
      { status: false, message: error.message },
      { status: 400 }
    )
  return NextResponse.json({ status: true, data })
}

export async function POST(req: Request) {
  const { name, amount, description } = await req.json()
  if (!name || typeof amount !== 'number') {
    return NextResponse.json(
      { status: false, message: 'Invalid data' },
      { status: 400 }
    )
  }

  const { data, error } = await supabaseAdmin
    .from('investment_plans')
    .insert({ name, amount, description: description ?? null })
    .select()
    .single()

  if (error)
    return NextResponse.json(
      { status: false, message: error.message },
      { status: 400 }
    )
  return NextResponse.json({ status: true, data })
}

export async function PATCH(req: Request) {
  const { id, name, amount, description } = await req.json()
  if (!id)
    return NextResponse.json(
      { status: false, message: 'Missing id' },
      { status: 400 }
    )

  const { data, error } = await supabaseAdmin
    .from('investment_plans')
    .update({
      ...(name !== undefined ? { name } : {}),
      ...(amount !== undefined ? { amount } : {}),
      ...(description !== undefined ? { description } : {}),
    })
    .eq('id', id)
    .select()
    .single()

  if (error)
    return NextResponse.json(
      { status: false, message: error.message },
      { status: 400 }
    )
  return NextResponse.json({ status: true, data })
}

export async function DELETE(req: Request) {
  const { id } = await req.json()
  if (!id)
    return NextResponse.json(
      { status: false, message: 'Missing id' },
      { status: 400 }
    )

  const { error } = await supabaseAdmin
    .from('investment_plans')
    .delete()
    .eq('id', id)
  if (error)
    return NextResponse.json(
      { status: false, message: error.message },
      { status: 400 }
    )

  return NextResponse.json({ status: true })
}
