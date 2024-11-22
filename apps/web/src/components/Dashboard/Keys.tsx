import { Button } from '../Button'
import { Button as AlertDialogAction } from '../ui/button'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Edit, MoreVertical, Trash } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useToast } from '../ui/use-toast'
import { E2BUser, Team } from '@/utils/useUser'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'

type TeamApiKey = {
  id: string
  value: string | null
  maskedValue: string
  name: string
  createdBy: {
    email: string
    id: string
  } | null
  createdAt: string
  lastUsed: string | null
  updatedAt: string | null
}

export const KeysContent = ({
  currentTeam,
  user,
}: {
  currentTeam: Team
  user: E2BUser
}) => {
  const { toast } = useToast()
  const [isKeyDialogOpen, setIsKeyDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isKeyPreviewDialogOpen, setIsKeyPreviewDialogOpen] = useState(false)
  const [currentKey, setCurrentKey] = useState<TeamApiKey | null>(null)
  const [newApiKeyInput, setNewApiKeyInput] = useState<string>('')
  const [apiKeys, setApiKeys] = useState<TeamApiKey[]>([])

  useEffect(() => {
    async function fetchApiKeys() {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BILLING_API_URL}/teams/${currentTeam.id}/api-keys`,
        {
          headers: {
            'X-USER-ACCESS-TOKEN': user.accessToken,
          },
        }
      )

      if (!res.ok) {
        toast({
          title: 'An error occurred',
          description: 'We were unable to fetch the team API keys',
        })
        console.log(res.statusText)
        return
      }

      const keys = await res.json()
      setApiKeys(keys)
    }

    fetchApiKeys()
  }, [currentTeam])

  async function deleteApiKey() {
    if (apiKeys.length === 1) {
      toast({
        title: 'Cannot delete the last API key',
        description: 'You must have at least one API key',
      })
      return
    }

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BILLING_API_URL}/teams/${currentTeam.id}/api-keys/${currentKey?.id}`,
      {
        method: 'DELETE',
        headers: {
          'X-USER-ACCESS-TOKEN': user.accessToken,
        },
      }
    )

    if (!res.ok) {
      toast({
        title: 'An error occurred',
        description: 'We were unable to delete the API key',
      })
    }

    setApiKeys(apiKeys.filter((apiKey) => apiKey.id !== currentKey?.id))
    setCurrentKey(null)
    setIsDeleteDialogOpen(false)
  }

  async function createApiKey() {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BILLING_API_URL}/teams/${currentTeam.id}/api-keys`,
      {
        method: 'POST',
        headers: {
          'X-USER-ACCESS-TOKEN': user.accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newApiKeyInput,
        }),
      }
    )

    if (!res.ok) {
      toast({
        title: 'An error occurred',
        description: 'We were unable to create the API key',
      })

      return
    }

    const newKey = await res.json()

    setApiKeys([...apiKeys, newKey])
    setNewApiKeyInput('')
    setCurrentKey(newKey)
    setIsKeyPreviewDialogOpen(true)
  }

  async function updateApiKey() {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BILLING_API_URL}/teams/${currentTeam.id}/api-keys/${currentKey?.id}`,
      {
        method: 'PATCH',
        headers: {
          'X-USER-ACCESS-TOKEN': user.accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newApiKeyInput,
        }),
      }
    )

    if (!res.ok) {
      toast({
        title: 'An error occurred',
        description: 'We were unable to update the API key',
      })
    }

    toast({
      title: 'API key updated',
    })

    setApiKeys(
      apiKeys.map((apiKey) =>
        apiKey.id === currentKey?.id
          ? {
              ...apiKey,
              name: newApiKeyInput,
            }
          : apiKey
      )
    )

    setNewApiKeyInput('')
    setCurrentKey(null)
    setIsKeyDialogOpen(false)
  }

  // remove the first API key from the list (for legacy reasons) and sort the rest by creation date
  const sortedApiKeys = useMemo(() => {
    const rest = apiKeys.slice(1)
    return rest.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [apiKeys])

  function copyApiKey() {
    navigator.clipboard.writeText(
      currentKey?.value || currentKey?.maskedValue || ''
    )

    toast({
      title: 'Copied API key to clipboard',
    })
  }

  return (
    <div className="flex flex-col w-full h-full">
      <div className="flex flex-col w-full pb-10">
        <Button
          className="w-fit"
          onClick={() => {
            setCurrentKey(null)
            setNewApiKeyInput('')
            setIsKeyDialogOpen(true)
          }}
        >
          Add API Key
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-orange-500/10 dark:hover:bg-orange-500/10 border-b border-white/5">
            <TableHead>Name</TableHead>
            <TableHead>Key</TableHead>
            <TableHead>Created by</TableHead>
            <TableHead>Created at</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedApiKeys.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center">
                Click on 'Add API Key' button above to create your first API
                key.
              </TableCell>
            </TableRow>
          ) : (
            sortedApiKeys.map((apiKey, index) => (
              <TableRow
                className="hover:bg-orange-300/10 dark:hover:bg-orange-300/10 border-b border-white/5"
                key={index}
              >
                <TableCell>{apiKey.name}</TableCell>
                <TableCell className="font-mono">
                  {apiKey.maskedValue}
                </TableCell>
                <TableCell>{apiKey.createdBy?.email}</TableCell>
                <TableCell>
                  {new Date(apiKey.createdAt).toLocaleString('en-UK', {
                    timeZoneName: 'short',
                  })}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger>
                      <MoreVertical className="w-4 h-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem
                        onClick={() => {
                          setNewApiKeyInput(apiKey.name)
                          setCurrentKey(apiKey)
                          setIsKeyDialogOpen(true)
                        }}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-500"
                        onClick={() => {
                          setCurrentKey(apiKey)
                          setIsDeleteDialogOpen(true)
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

      <AlertDialog open={isKeyDialogOpen} onOpenChange={setIsKeyDialogOpen}>
        <AlertDialogContent className="bg-inherit text-white border-black">
          <AlertDialogHeader>
            <AlertDialogTitle>
              You are about to {currentKey ? 'edit' : 'create'} an API key
            </AlertDialogTitle>
          </AlertDialogHeader>
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              currentKey ? updateApiKey() : createApiKey()
              setIsKeyDialogOpen(false)
            }}
          >
            <input
              type="text"
              className="border border-white/10 text-sm focus:outline-none outline-none rounded-md p-2"
              placeholder="Name"
              value={newApiKeyInput}
              onChange={(e) => {
                setNewApiKeyInput(e.target.value)
              }}
              autoFocus
              required
            />

            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  setIsKeyDialogOpen(false)
                  setCurrentKey(null)
                  setNewApiKeyInput('')
                }}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction type="submit">
                {currentKey ? 'Update' : 'Create'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={isKeyPreviewDialogOpen}
        onOpenChange={setIsKeyPreviewDialogOpen}
      >
        <AlertDialogContent className="bg-inherit text-white border-black">
          <AlertDialogHeader>
            <AlertDialogTitle>Your API key</AlertDialogTitle>
            <AlertDialogDescription>
              You will only see the API key once. Make sure to copy it now.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <form className="flex flex-col gap-2">
            <input
              type="text"
              className="border border-white/10 text-sm focus:outline-none outline-none rounded-md p-2"
              placeholder="Name"
              value={currentKey?.value || currentKey?.maskedValue}
              autoFocus
              required
              readOnly
            />

            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  setIsKeyPreviewDialogOpen(false)
                  setCurrentKey(null)
                }}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                type="button"
                onClick={() => {
                  copyApiKey()
                  setIsKeyPreviewDialogOpen(false)
                }}
              >
                Copy
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogTrigger asChild>
          <Button variant="outline" style={{ display: 'none' }}>
            Show Dialog
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="bg-inherit text-white border-black">
          <AlertDialogHeader>
            <AlertDialogTitle>
              You are about to delete an API key
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/90">
              This action cannot be undone. This will permanently delete the API
              key with immediate effect.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="border-white/10"
              onClick={() => {
                setIsDeleteDialogOpen(false)
                setCurrentKey(null)
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 text-white hover:bg-red-600"
              onClick={deleteApiKey}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
