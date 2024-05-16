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

const fakeSandboxes = [
  {
    id: '1',
    template: 'base',
    cpuCount: 2,
    memoryMB: 512,
    startedAt: '2023-11-12T10:21:33.000Z',
    clientID: '1',
  },
  {
    id: '2',
    template: 'base',
    cpuCount: 2,
    memoryMB: 512,
    startedAt: '2023-05-16T10:01:23.000Z',
    clientID: '1',
  },
]

export const SandboxesContent = () => {
  const [runningSandboxes, setRunningSandboxes] = useState(fakeSandboxes)
  useSimulateSandboxLifecycle(runningSandboxes, setRunningSandboxes)

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
            key={sandbox.id}>
              <TableCell>{sandbox.id}</TableCell>
              <TableCell>{sandbox.template}</TableCell>
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

const useSimulateSandboxLifecycle = (runningSandboxes, setRunningSandboxes) => {
  useEffect(() => {
    const interval = setInterval(() => {
      setRunningSandboxes((prevSandboxes) => {
        // Decide randomly to add or remove a sandbox
        const shouldAdd = Math.random() > 0.5
        if (shouldAdd) {
          // Add a new sandbox
          const newSandbox = generateNewSandbox()
          return [...prevSandboxes, newSandbox]
        } else if (prevSandboxes.length > 0) {
          // Remove a random sandbox
          const randomIndex = Math.floor(Math.random() * prevSandboxes.length)
          return prevSandboxes.filter((_, index) => index !== randomIndex)
        }
        return prevSandboxes
      })
    }, 1000) // Run every second

    // Cleanup interval on component unmount
    return () => clearInterval(interval)
  }, [setRunningSandboxes])
}


const generateNewSandbox = () => {
  return {
    id: (Math.random() * 10000).toFixed(0),
    template: 'base',
    cpuCount: Math.floor(Math.random() * 4) + 1,
    memoryMB: Math.floor(Math.random() * 2048) + 512,
    startedAt: new Date().toISOString(),
    clientID: (Math.random() * 10).toFixed(0),
  }
}

