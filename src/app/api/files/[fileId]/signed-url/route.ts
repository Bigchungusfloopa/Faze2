import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getSignedUrlForR2 } from '@/lib/r2'
import { NextResponse } from 'next/server'

const adminSupabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
    _req: Request,
    context: { params: Promise<{ fileId: string }> }
) {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { fileId } = await context.params

    const { data: file, error } = await adminSupabase
        .from('files')
        .select('r2_object_key')
        .eq('id', fileId)
        .maybeSingle()

    if (error || !file) return NextResponse.json({ error: 'File not found' }, { status: 404 })

    const url = await getSignedUrlForR2(file.r2_object_key)
    return NextResponse.json({ url })
}
