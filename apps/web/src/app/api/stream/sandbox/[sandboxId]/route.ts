import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySandbox } from '@/lib/utils'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function GET(
  request: Request,
  { params }: { params: { sandboxId: string } }
) {
  const apiKey = request.headers.get('X-API-Key')
  const sandboxId = params.sandboxId

  if (!sandboxId) {
    return NextResponse.json({ error: 'Missing sandbox ID' }, { status: 400 })
  }

  if (!apiKey) {
    return NextResponse.json({ error: 'Missing E2B API Key' }, { status: 400 })
  }

  if (!(await verifySandbox(apiKey, sandboxId))) {
    return NextResponse.json({ error: 'Invalid E2B API Key' }, { status: 401 })
  }

  const { data: stream, error } = await supabase
    .from('sandbox_streams')
    .select('token')
    .eq('sandbox_id', sandboxId)
    .single()

  if (error) {
    return NextResponse.json(
      { error: `Failed to retrieve stream - ${error.message}` },
      { status: 500 }
    )
  }

  if (!stream) {
    return NextResponse.json(
      { error: `Stream not found for sandbox ${sandboxId}` },
      { status: 404 }
    )
  }

  return NextResponse.json({ token: stream.token }, { status: 200 })
}
