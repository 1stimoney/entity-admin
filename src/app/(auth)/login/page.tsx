'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2, LogIn } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const next = useMemo(() => {
    // default to /admin (your middleware will bounce non-admin to /dashboard)
    const n = searchParams.get('next')
    return n && n.startsWith('/') ? n : '/admin'
  }, [searchParams])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)

  // If already logged in, bounce to next immediately
  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      if (data?.user) {
        router.replace(next)
        router.refresh()
      }
    })()
  }, [router, next])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      toast.error('Enter email and password.')
      return
    }

    try {
      setLoading(true)

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (error) {
        toast.error(error.message || 'Login failed.')
        return
      }

      toast.success('Welcome back! Redirecting…')

      // ✅ force route change + re-check middleware/server components
      router.replace(next)
      router.refresh()

      // ✅ fallback in case router doesn’t re-evaluate cookies fast enough
      setTimeout(() => {
        window.location.href = next
      }, 350)
    } catch (err) {
      console.error(err)
      toast.error('Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100'>
      <div className='mx-auto max-w-6xl px-4 py-10'>
        <div className='grid lg:grid-cols-2 gap-10 items-center'>
          {/* Left: Marketing */}
          <div className='hidden lg:block'>
            <div className='max-w-lg space-y-4'>
              <h1 className='text-4xl font-bold tracking-tight'>
                Welcome back to <span className='text-blue-600'>Entity</span>
              </h1>
              <p className='text-slate-600'>
                Log in to access your dashboard and (if you’re an admin) the
                admin panel.
              </p>

              <div className='mt-6 rounded-2xl border bg-white p-4 shadow-sm'>
                <div className='flex items-center justify-between'>
                  <div className='text-sm font-semibold text-slate-800'>
                    Secure login
                  </div>
                  <div className='text-xs text-slate-500'>Supabase Auth</div>
                </div>

                <div className='mt-4 overflow-hidden rounded-xl border'>
                  <Image
                    src='/illustration.png'
                    alt='illustration'
                    width={900}
                    height={520}
                    className='h-56 w-full object-cover'
                    priority
                  />
                </div>

                <p className='mt-3 text-xs text-slate-500'>
                  Tip: If you’re not an admin, you’ll be redirected to your
                  dashboard automatically.
                </p>
              </div>
            </div>
          </div>

          {/* Right: Form */}
          <div className='flex justify-center'>
            <Card className='w-full max-w-md rounded-2xl border bg-white p-7 shadow-xl'>
              <div className='flex items-center justify-between'>
                <div>
                  <h2 className='text-2xl font-bold'>Log in</h2>
                  <p className='text-sm text-slate-600 mt-1'>
                    Enter your credentials to continue.
                  </p>
                </div>
                <div className='h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center'>
                  <LogIn className='h-5 w-5 text-slate-700' />
                </div>
              </div>

              <Separator className='my-6' />

              <form onSubmit={onSubmit} className='space-y-4'>
                <div className='space-y-2'>
                  <label className='text-sm font-medium'>Email</label>
                  <Input
                    type='email'
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder='you@example.com'
                    autoComplete='email'
                    required
                  />
                </div>

                <div className='space-y-2'>
                  <label className='text-sm font-medium'>Password</label>
                  <div className='relative'>
                    <Input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder='••••••••'
                      autoComplete='current-password'
                      required
                      className='pr-11'
                    />
                    <button
                      type='button'
                      onClick={() => setShowPw((s) => !s)}
                      className='absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-600 hover:bg-slate-100'
                      aria-label={showPw ? 'Hide password' : 'Show password'}
                    >
                      {showPw ? (
                        <EyeOff className='h-4 w-4' />
                      ) : (
                        <Eye className='h-4 w-4' />
                      )}
                    </button>
                  </div>
                </div>

                <Button
                  type='submit'
                  className='w-full rounded-xl py-6 text-base'
                  disabled={loading}
                >
                  {loading ? (
                    <span className='flex items-center gap-2'>
                      <Loader2 className='h-4 w-4 animate-spin' /> Signing in…
                    </span>
                  ) : (
                    'Log in'
                  )}
                </Button>

                <div className='flex items-center justify-between text-sm'>
                  <Link
                    href='/forgot-password'
                    className='text-slate-600 hover:text-slate-900 hover:underline'
                  >
                    Forgot password?
                  </Link>
                  <Link
                    href={
                      next
                        ? `/sign-up?next=${encodeURIComponent(next)}`
                        : '/sign-up'
                    }
                    className='font-medium text-blue-600 hover:underline'
                  >
                    Create account
                  </Link>
                </div>

                {next && next !== '/admin' && (
                  <p className='text-xs text-slate-500'>
                    After login you’ll be redirected to:{' '}
                    <span className='font-medium'>{next}</span>
                  </p>
                )}
              </form>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
