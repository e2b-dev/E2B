'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
// @ts-ignore
import MuxPlayer from '@mux/mux-player-react'



interface SandboxStream {
  sandboxId: string
  playbackId: string
}

export default function StreamPage() {
  const searchParams = useSearchParams()
  const sandboxId = searchParams.get('sandboxId')
  const [stream, setStream] = useState<SandboxStream | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStream = async () => {
      if (sandboxId) {
        try {
          const response = await fetch(`/api/stream/sandbox?sandboxId=${sandboxId}`)
          if (!response.ok) {
            throw new Error('Network response was not ok')
          }
          const data = await response.json()
          setStream(data)
        } catch (err) {
          setError(err.message)
        }
      }
    }

    fetchStream()
  }, [sandboxId])

  if (error) {
    return <div>Error loading stream: {error}</div>
  }

  if (!stream) {
    return <div>Stream not found</div>
  }
  console.log('stream', stream)

  return (
    <Suspense fallback={<div>Loading...</div>}>
      hello
      <h1>Stream Details</h1>
      <div>Sandbox ID: {stream.sandboxId}</div>
      <div>Playback ID: {stream.playbackId}</div>

      <MuxPlayer
        playbackId={stream.playbackId}
        metadata={{
          video_id: 'video-id-54321',
          video_title: 'Test video title',
          viewer_user_id: 'user-id-007',
        }}
      />
    </Suspense>
  )
}