import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { target_type, target_id, value } = body

    const adminSupabase = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    if (!['thread', 'reply'].includes(target_type)) {
        return NextResponse.json({ error: 'Invalid target_type' }, { status: 400 })
    }
    if (![1, -1].includes(value)) {
        return NextResponse.json({ error: 'Value must be 1 or -1' }, { status: 400 })
    }

    // Check for existing vote
    const { data: existing } = await adminSupabase
        .from('votes')
        .select('id, value')
        .eq('user_id', user.id)
        .eq('target_type', target_type)
        .eq('target_id', target_id)
        .maybeSingle()

    if (existing) {
        if (existing.value === value) {
            // Same vote again → toggle off (delete)
            await adminSupabase.from('votes').delete().eq('id', existing.id)
            return NextResponse.json({ my_vote: 0 })
        } else {
            // Different value → update
            const { error } = await adminSupabase
                .from('votes')
                .update({ value })
                .eq('id', existing.id)
            if (error) return NextResponse.json({ error: error.message }, { status: 500 })
            return NextResponse.json({ my_vote: value })
        }
    }

    // No existing vote → insert
    const { error } = await adminSupabase.from('votes').insert({
        user_id: user.id,
        target_type,
        target_id,
        value,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ my_vote: value }, { status: 201 })
}
