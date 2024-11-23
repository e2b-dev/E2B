import Mux from '@mux/mux-node'
import { NextResponse } from 'next/server'

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID,
  tokenSecret: process.env.MUX_TOKEN_SECRET
})

export async function POST(request: Request) {
  // TODO: UseG apiKey
  // const apiKey = request.headers.get('X-API-Key')
  const { sandboxId } = await request.json()
  console.log('sandboxId', sandboxId)

  // if (!apiKey) {
  //   return NextResponse.json({ error: 'Missing X-API-Key' }, { status: 400 })
  // }

  if (!sandboxId) {
    return NextResponse.json({ error: 'Missing sandboxId' }, { status: 400 })
  }

  const liveStream = await mux.video.liveStreams.create({
    latency_mode: 'low',
    reconnect_window: 60,
    playback_policy: ['public'],
    new_asset_settings: { playback_policy: ['public'] },
  })

  if (!liveStream.playback_ids?.[0]?.id) {
    return NextResponse.json({ error: 'Failed to create live stream' }, { status: 500 })
  }

  await supabase
    .from('sandbox_streams')
    .insert([{ sandbox_id: sandboxId, playback_id: liveStream.playback_ids[0].id }])

  return NextResponse.json({ streamKey: liveStream.stream_key }, { status: 201 })
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const sandboxId = url.searchParams.get('sandboxId')

  if (!sandboxId) {
    return NextResponse.json({ error: 'Missing sandboxId' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('sandbox_streams')
    .select('playback_id')
    .eq('sandbox_id', sandboxId)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Playback ID not found' }, { status: 404 })
  }

  return NextResponse.json({ playbackId: data.playback_id }, { status: 200 })
}
