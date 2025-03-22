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
import { E2BUser } from '@/utils/useUser'
import { Lock, LockOpen, MoreVertical, Trash } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogAction,
} from '../ui/alert-dialog'
import { toast } from '../ui/use-toast'
import { getAPIUrl } from '@/app/(dashboard)/dashboard/utils'

interface Template {
  aliases: string[]
  buildID: string
  cpuCount: number
  memoryMB: number
  public: boolean
  templateID: string
  createdAt: string
  updatedAt: string
  createdBy: {
    email: string
    id: string
  } | null
}

export function TemplatesContent({
  user,
  teamId,
  domain,
}: {
  user: E2BUser
  teamId: string
  domain: string
}) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [currentTemplate, setCurrentTemplate] = useState<Template | null>(null)
  const [isPublishTemplateDialogOpen, setIsPublishTemplateDialogOpen] =
    useState(false)
  const [isDeleteTemplateDialogOpen, setIsDeleteTemplateDialogOpen] =
    useState(false)

  useEffect(() => {
    async function f() {
      const accessToken = user.accessToken
      if (accessToken) {
        fetchTemplates(domain, accessToken, teamId).then((newTemplates) => {
          if (newTemplates) {
            setTemplates(newTemplates)
          }
        })
      }
    }

    f()
  }, [domain, user, teamId])

  async function deleteTemplate(domain: string) {
    const res = await fetch(
      getAPIUrl(domain, `/templates/${currentTemplate?.templateID}`),
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${user.accessToken}`,
        },
      }
    )

    if (!res.ok) {
      return toast({
        title: 'An error occurred',
        description: 'We were unable to delete the template',
      })
    }

    setTemplates(
      templates.filter(
        (template) => template.templateID !== currentTemplate?.templateID
      )
    )
    setCurrentTemplate(null)
    setIsDeleteTemplateDialogOpen(false)
  }

  async function publishTemplate(domain: string) {
    const res = await fetch(
      getAPIUrl(domain, `/templates/${currentTemplate?.templateID}`),
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${user.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          public: !currentTemplate?.public,
        }),
      }
    )

    if (!res.ok) {
      return toast({
        title: 'An error occurred',
        description: 'We were unable to update the template',
      })
    }

    toast({
      title: 'Template updated',
      description: 'The template has been updated successfully',
    })

    setTemplates(
      templates.map((template) =>
        template.templateID === currentTemplate?.templateID
          ? { ...template, public: !template.public }
          : template
      )
    )
    setCurrentTemplate(null)
    setIsPublishTemplateDialogOpen(false)
  }

  return (
    <div className="flex flex-col justify-center">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-orange-500/10 dark:hover:bg-orange-500/10 border-b border-white/5">
            <TableHead>Access</TableHead>
            <TableHead>Template ID</TableHead>
            <TableHead>Template Name</TableHead>
            <TableHead>vCPUs</TableHead>
            <TableHead>RAM MiB</TableHead>
            <TableHead>Created by</TableHead>
            <TableHead>Created at</TableHead>
            <TableHead>Updated at</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {templates.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center">
                No templates
              </TableCell>
            </TableRow>
          ) : (
            templates.map((template) => (
              <TableRow
                className="hover:bg-orange-300/10 dark:hover:bg-orange-300/10 border-b border-white/5"
                key={template.templateID}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    {template.public ? (
                      <LockOpen className="w-4 h-4" />
                    ) : (
                      <Lock className="w-4 h-4" />
                    )}
                    <span className="text-xs">
                      {template.public ? 'Public' : 'Private'}
                    </span>
                  </div>
                </TableCell>
                <TableCell>{template.templateID}</TableCell>
                <TableCell className="font-mono">
                  {template.aliases.join(', ')}
                </TableCell>
                <TableCell>{template.cpuCount}</TableCell>
                <TableCell>{template.memoryMB}</TableCell>
                <TableCell>{template.createdBy?.email}</TableCell>
                <TableCell>
                  {new Date(template.createdAt).toLocaleString()}
                </TableCell>
                <TableCell>
                  {new Date(template.updatedAt).toLocaleString()}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger>
                      <MoreVertical className="w-4 h-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem
                        onClick={() => {
                          setCurrentTemplate(template)
                          setIsPublishTemplateDialogOpen(true)
                        }}
                      >
                        {template.public ? (
                          <Lock className="w-4 h-4 mr-2" />
                        ) : (
                          <LockOpen className="w-4 h-4 mr-2" />
                        )}
                        {template.public ? 'Unpublish' : 'Publish'}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-500"
                        onClick={() => {
                          setCurrentTemplate(template)
                          setIsDeleteTemplateDialogOpen(true)
                        }}
                      >
                        <Trash className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <AlertDialog
        open={isPublishTemplateDialogOpen}
        onOpenChange={setIsPublishTemplateDialogOpen}
      >
        <AlertDialogContent className="bg-inherit text-white border-black">
          <AlertDialogHeader>
            <AlertDialogTitle>
              You are about to{' '}
              {currentTemplate?.public ? 'unpublish' : 'publish'} a template
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/90">
              This will make the template{' '}
              {currentTemplate?.public
                ? 'private to your team'
                : 'public to everyone outside your team'}{' '}
              with immediate effect.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="border-white/10"
              onClick={() => {
                setIsPublishTemplateDialogOpen(false)
                setCurrentTemplate(null)
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => publishTemplate(domain)}>
              {currentTemplate?.public ? 'Unpublish' : 'Publish'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={isDeleteTemplateDialogOpen}
        onOpenChange={setIsDeleteTemplateDialogOpen}
      >
        <AlertDialogContent className="bg-inherit text-white border-black">
          <AlertDialogHeader>
            <AlertDialogTitle>
              You are about to delete a template
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/90">
              This action cannot be undone. This will permanently delete the
              template with immediate effect.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="border-white/10"
              onClick={() => {
                setIsDeleteTemplateDialogOpen(false)
                setCurrentTemplate(null)
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 text-white hover:bg-red-600"
              onClick={() => deleteTemplate(domain)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

async function fetchTemplates(
  domain: string,
  accessToken: string,
  teamId: string
): Promise<Template[]> {
  const res = await fetch(getAPIUrl(domain, `templates?teamID=${teamId}`), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
  try {
    const data: Template[] = await res.json()
    const orderedData = data.sort((a, b) => {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
    return orderedData
  } catch (e) {
    // TODO: add sentry event here
    return []
  }
}
