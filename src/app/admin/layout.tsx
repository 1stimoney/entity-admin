import Link from 'next/link'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className='min-h-screen bg-muted/30'>
      <div className='mx-auto max-w-7xl px-4 py-6'>
        <div className='flex items-center justify-between'>
          <div>
            <div className='text-2xl font-bold'>Entity Admin</div>
            <div className='text-sm text-muted-foreground'>
              Manage users, plans, withdrawals & more
            </div>
          </div>

          <nav className='flex flex-wrap gap-2 text-sm'>
            <Link className='rounded-lg px-3 py-2 hover:bg-muted' href='/admin'>
              Overview
            </Link>
            <Link
              className='rounded-lg px-3 py-2 hover:bg-muted'
              href='/admin/users'
            >
              Users
            </Link>
            <Link
              className='rounded-lg px-3 py-2 hover:bg-muted'
              href='/admin/transactions'
            >
              Transactions
            </Link>
            <Link
              className='rounded-lg px-3 py-2 hover:bg-muted'
              href='/admin/withdrawals'
            >
              Withdrawals
            </Link>
            <Link
              className='rounded-lg px-3 py-2 hover:bg-muted'
              href='/admin/plans'
            >
              Plans
            </Link>
            <Link
              className='rounded-lg px-3 py-2 hover:bg-muted'
              href='/admin/referrals'
            >
              Referrals
            </Link>
          </nav>
        </div>

        <div className='mt-6'>{children}</div>
      </div>
    </div>
  )
}
