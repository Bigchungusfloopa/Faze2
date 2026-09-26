import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params

  const { data: community, error: communityError } = await supabase
    .from('communities')
    .select('*')
    .eq('id', id)
    .single()

  if (communityError || !community) {
    return NextResponse.json({ error: 'Community not found' }, { status: 404 })
  }

  const { data: memberData } = await supabase
    .from('community_members')
    .select('role')
    .eq('community_id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({
    ...community,
    membership: memberData ? { role: memberData.role } : null
  })
}
