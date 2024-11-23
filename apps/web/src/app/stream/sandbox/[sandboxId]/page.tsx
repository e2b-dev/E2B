import { Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import MuxPlayer from '@mux/mux-player-react'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface SandboxStream {
  sandboxId: string
  playbackId: string
}

async function fetchStream(sandboxId: string): Promise<SandboxStream | null> {
  const { data, error } = await supabase
    .from('sandbox_streams')
    .select('playback_id')
    .eq('sandbox_id', sandboxId)
    .single()

  if (error || !data) {
    return null
  }

  return { sandboxId, playbackId: data.playback_id }
}

export default async function StreamPage({ params }: { params: { sandboxId: string } }) {
  const stream = await fetchStream(params.sandboxId)

  if (!stream) {
    return <div>Stream not found</div>
  }

  return (
    <Suspense fallback={<div className="h-full w-full flex items-center justify-center">Loading stream...</div>}>
      <div className="h-full w-full">
        <MuxPlayer
          autoPlay
          muted
          playbackId={stream.playbackId}
          themeProps={{ controlBarVertical: true, controlBarPlace: 'start start' }}
          metadata={{
            video_id: `sandbox-${stream.sandboxId}`,
            video_title: 'Desktop Sandbox Stream',
          }}
          streamType="live"
        />
      </div>
    </Suspense>
  )
}
