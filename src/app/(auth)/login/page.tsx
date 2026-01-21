import LoginClient from './LoginClient'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const sp = await searchParams

  // default to /admin (middleware can bounce non-admins elsewhere)
  const next =
    sp?.next && sp.next.startsWith('/') ? sp.next.toString() : '/admin'

  return <LoginClient nextPath={next} />
}
