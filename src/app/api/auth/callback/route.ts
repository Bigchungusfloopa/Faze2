import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Only same-site paths, so the callback can't be used as an open redirect.
function safeNext(next: string | null) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/chat'
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${safeNext(searchParams.get('next'))}`)
  }

  return NextResponse.redirect(`${origin}/login?error=true`)
}
