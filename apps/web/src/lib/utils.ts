import { Sandbox } from 'e2b'
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Verify that the sandbox exists and is associated with the API key
export async function verifySandbox(apiKey: string, sandboxId: string) {
  try {
    const sandbox = await Sandbox.getInfo(sandboxId, { apiKey })
    return sandbox.state === 'running'
  } catch (error) {
    return false
  }
}
