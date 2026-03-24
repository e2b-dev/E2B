import Mux from '@mux/mux-node'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySandbox } from '@/lib/utils'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID,
  tokenSecret: process.env.MUX_TOKEN_SECRET,
})

// Create a new live stream and return the stream key
export async function POST(request: Request) {
  const apiKey = request.headers.get('X-API-Key')
  const { sandboxId } = await request.json()

  if (!sandboxId) {
    return NextResponse.json({ error: 'Missing sandboxId' }, { status: 400 })
  }

  if (!apiKey) {
    return NextResponse.json({ error: 'Missing E2B API Key' }, { status: 400 })
  }

  if (!(await verifySandbox(apiKey, sandboxId))) {
    return NextResponse.json({ error: 'Invalid E2B API Key' }, { status: 401 })
  }

  // Check if a stream already exists for the sandbox
  const { data: existingStream, error: existingStreamError } = await supabase
    .from('sandbox_streams')
    .select('token')
    .eq('sandbox_id', sandboxId)
    .single()

  if (existingStreamError && existingStreamError.code !== 'PGRST116') {
    return NextResponse.json(
      {
        error: `Failed to check existing stream - ${existingStreamError.message}`,
      },
      { status: 500 }
    )
  }

  if (existingStream) {
    return NextResponse.json(
      {
        error: `Stream for the sandbox '${sandboxId}' already exists. There can be only one stream per sandbox.`,
      },
      { status: 400 }
    )
  }

  // The stream doesn't exist yet, so create a new live stream
  const liveStream = await mux.video.liveStreams.create({
    latency_mode: 'low',
    reconnect_window: 60,
    playback_policy: ['public'],
    new_asset_settings: { playback_policy: ['public'] },
  })

  if (!liveStream.playback_ids?.[0]?.id) {
    return NextResponse.json(
      { error: 'Failed to create live stream' },
      { status: 500 }
    )
  }

  const { data, error }: { data: { token: string } | null; error: any } =
    await supabase
      .from('sandbox_streams')
      .insert([
        { sandbox_id: sandboxId, playback_id: liveStream.playback_ids[0].id },
      ])
      .select('token')
      .single()

  if (error) {
    return NextResponse.json(
      { error: `Failed to insert and retrieve token - ${error.message}` },
      { status: 500 }
    )
  }

  if (!data) {
    return NextResponse.json(
      { error: 'Failed to insert and retrieve token - no data' },
      { status: 500 }
    )
  }

  return NextResponse.json(
    { streamKey: liveStream.stream_key, token: data.token },
    { status: 201 }
  )
}
