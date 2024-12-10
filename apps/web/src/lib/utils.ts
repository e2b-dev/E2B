import { Sandbox } from 'e2b'
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Verify that the sandbox exists and is associated with the API key
export async function verifySandbox(apiKey: string, sandboxId: string) {
  const sandboxes = await Sandbox.list({ apiKey })
  return sandboxes.some((sandbox) => sandbox.sandboxId === sandboxId)
}