'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  ArrowDownToLine,
  ReceiptText,
} from 'lucide-react'
import { cn } from '@/lib/utils' // if you have shadcn utils
import { Button } from '@/components/ui/button'

const nav = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/withdrawals', label: 'Withdrawals', icon: ArrowDownToLine },
  { href: '/admin/transactions', label: 'Transactions', icon: ReceiptText },
]

export default function AdminShell({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className='min-h-screen bg-muted/30'>
      <div className='mx-auto max-w-7xl p-4 md:p-8'>
        <div className='grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6'>
          <aside className='bg-background border rounded-2xl p-3 md:p-4 h-fit sticky top-4'>
            <div className='px-2 py-2'>
              <div className='text-lg font-semibold'>Admin Panel</div>
              <div className='text-xs text-muted-foreground'>Entity</div>
            </div>

            <div className='mt-3 space-y-1'>
              {nav.map((item) => {
                const active = pathname === item.href
                const Icon = item.icon
                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant={active ? 'default' : 'ghost'}
                      className={cn(
                        'w-full justify-start gap-2',
                        !active && 'hover:bg-muted'
                      )}
                    >
                      <Icon className='h-4 w-4' />
                      {item.label}
                    </Button>
                  </Link>
                )
              })}
            </div>

            <div className='mt-6 text-xs text-muted-foreground px-2'>
              Only allowlisted admins can access this.
            </div>
          </aside>

          <main className='bg-background border rounded-2xl p-4 md:p-6'>
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
