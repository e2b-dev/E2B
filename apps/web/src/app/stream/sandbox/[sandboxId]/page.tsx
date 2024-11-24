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

async function fetchStream(sandboxId: string, token: string): Promise<SandboxStream | null> {
  const { data, error } = await supabase
    .from('sandbox_streams')
    .select('playback_id')
    .eq('sandbox_id', sandboxId)
    .eq('token', token)
    .single()

  if (error || !data) {
    return null
  }

  return { sandboxId, playbackId: data.playback_id }
}

export default async function StreamPage({
  params,
  searchParams // Add searchParams to props
}: {
  params: { sandboxId: string }
  searchParams: { token?: string } // Add type for searchParams
}) {
  const token = searchParams.token

  if (!token) {
    return <div>Missing token</div>
  }

  const stream = await fetchStream(params.sandboxId, token)

  if (!stream) {
    return <div>Stream not found</div>
  }

  return (
    <Suspense fallback={<div className="h-full w-full flex items-center justify-center">Loading stream...</div>}>
      <div className="flex justify-center max-h-[768px]">
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
