import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { useState } from 'react'
import { useEffect } from 'react'
import { Team}  from '@/utils/useUser'

interface Sandbox {
  sandboxID: string
  templateID: string
  cpuCount: number
  memoryMB: number
  startedAt: string
  clientID: string
}

export const SandboxesContent = ({ team } : { team: Team }) => {
  const [runningSandboxes, setRunningSandboxes] = useState<Sandbox[]>([])

  useEffect(() => {
    const interval = setInterval(() => {
      const apiKey = team.apiKeys[0]
      if (apiKey) {
        fetchSandboxes(apiKey).then((newSandboxes) => {
          if (newSandboxes) {
            setRunningSandboxes(newSandboxes)
          }
        })
      }
    }, 2000)

    // Cleanup interval on component unmount
    return () => clearInterval(interval)
  }, [team])

  return (
    <div className="flex flex-col justify-center">

      <h2 className="text-xl font-bold pb-4">Total Running Sandboxes: {runningSandboxes.length}</h2>

      <Table>
        <TableHeader>
          <TableRow className='hover:bg-orange-500/10 dark:hover:bg-orange-500/10 border-b border-white/5 '>
            <TableHead>ID</TableHead>
            <TableHead>Template</TableHead>
            <TableHead>CPU Count</TableHead>
            <TableHead>Memory (MB)</TableHead>
            <TableHead>Started At</TableHead>
            <TableHead>Client ID</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runningSandboxes.map((sandbox) => (
            <TableRow 
            className='hover:bg-orange-300/10 dark:hover:bg-orange-300/10 border-b border-white/5'
            key={sandbox.sandboxID}>
              <TableCell>{sandbox.sandboxID}</TableCell>
              <TableCell>{sandbox.templateID}</TableCell>
              <TableCell>{sandbox.cpuCount}</TableCell>
              <TableCell>{sandbox.memoryMB}</TableCell>
              <TableCell>{new Date(sandbox.startedAt).toLocaleString('en-UK', {timeZoneName: 'short'})}</TableCell>
              <TableCell>{sandbox.clientID}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
  
    </div>
  )
}

const fetchSandboxes = async (apiKey: string): Promise<Sandbox[]> => {

  const res = await fetch('https://api.e2b.dev/sandboxes', {
    method: 'GET',
    headers: {
      'X-API-KEY': apiKey,
    }
  })
  try {
    const data: Sandbox[] = await res.json()
    data.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())
    return data
  } catch (e) {
    // TODO: add sentry event here
    return []
  }
} 



