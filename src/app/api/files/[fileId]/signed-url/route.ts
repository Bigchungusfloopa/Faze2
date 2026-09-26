import { createClient } from '@/lib/supabase/server'
import { getViewUrl } from '@/lib/storage'
import { NextResponse } from 'next/server'

export async function GET(
    _req: Request,
    context: { params: Promise<{ fileId: string }> }
) {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { fileId } = await context.params

    // Cookie-scoped client + owner_id filter: RLS is the primary barrier here,
    // this .eq() is a second, explicit one. The previous version used a
    // service-role client and looked the file up by fileId alone -- any
    // logged-in user could mint a signed URL for anyone else's file.
    const { data: file, error } = await supabase
        .from('files')
        .select('storage_key')
        .eq('id', fileId)
        .eq('owner_id', user.id)
        .maybeSingle()

    if (error || !file) return NextResponse.json({ error: 'File not found' }, { status: 404 })

    const url = await getViewUrl(file.storage_key)
    return NextResponse.json({ url })
}
