import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  if (!req.nextUrl.pathname.startsWith('/admin')) return res

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', req.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  const { data: urow } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (urow?.role !== 'admin') {
    const url = req.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return res
}

export const config = {
  matcher: ['/admin/:path*'],
}
