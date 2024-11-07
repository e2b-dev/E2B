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
import { E2BUser, Team } from '@/utils/useUser'

interface Template {
  aliases: string[]
  buildID: string
  cpuCount: number
  memoryMB: number
  public: boolean
  templateID: string
}

export function TemplatesContent({ user }: { user: E2BUser }) {
  const [templates, setTemplates] = useState<Template[]>([])

  useEffect(() => {
    function f() {
      const apiKey = user.accessToken
      if (apiKey) {
        fetchTemplates(apiKey).then((newTemplates) => {
          if (newTemplates) {
            setTemplates(newTemplates)
          }
        })
      }
    }

    const interval = setInterval(() => {
      f()
    }, 5000)

    f()
    // Cleanup interval on component unmount
    return () => clearInterval(interval)
  }, [user])

  return (
    <div className="flex flex-col justify-center">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-orange-500/10 dark:hover:bg-orange-500/10 border-b border-white/5 ">
            <TableHead>Template ID</TableHead>
            <TableHead>Template Name</TableHead>
            <TableHead>vCPUs</TableHead>
            <TableHead>RAM MiB</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {templates.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center">
                No templates
              </TableCell>
            </TableRow>
          ) : (
            templates.map((template) => (
              <TableRow
                className="hover:bg-orange-300/10 dark:hover:bg-orange-300/10 border-b border-white/5"
                key={template.templateID}
              >
                <TableCell>{template.templateID}</TableCell>
                <TableCell>{template.aliases[0]}</TableCell>
                <TableCell>{template.cpuCount}</TableCell>
                <TableCell>{template.memoryMB}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

async function fetchTemplates(apiKey: string): Promise<Template[]> {
  const res = await fetch('https://api.e2b.dev/templates', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  })
  try {
    const data: Template[] = await res.json()
    return data
  } catch (e) {
    // TODO: add sentry event here
    return []
  }
}
