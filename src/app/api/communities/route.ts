import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')

  let query = supabase
    .from('communities')
    .select('*')
  
  if (q) {
    query = query.ilike('name', `%${q}%`)
  }

  const { data: communities, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: memberships } = await supabase
    .from('community_members')
    .select('community_id, role')
    .eq('user_id', user.id)

  const membershipMap = new Map()
  if (memberships) {
    memberships.forEach(m => membershipMap.set(m.community_id, m.role))
  }

  const enhancedCommunities = communities.map((c: any) => ({
    ...c,
    membership: membershipMap.has(c.id) ? { role: membershipMap.get(c.id) } : null
  }))

  return NextResponse.json(enhancedCommunities)
}
