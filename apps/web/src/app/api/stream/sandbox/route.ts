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
  const { sandboxId } = await request.json()

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
