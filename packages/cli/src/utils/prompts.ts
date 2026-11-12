import * as clack from '@clack/prompts'

function exitIfCanceled<Value>(value: Value | symbol): Value {
  if (clack.isCancel(value)) {
    clack.cancel('Canceled')
    process.exit(130)
  }
  return value as Value
}

export async function select<Value>(
  opts: clack.SelectOptions<Value>
): Promise<Value> {
  return exitIfCanceled(await clack.select(opts))
}

export async function text(opts: clack.TextOptions): Promise<string> {
  return exitIfCanceled(await clack.text(opts))
}

export async function confirm(
  message: string,
  initialValue = false
): Promise<boolean> {
  return exitIfCanceled(await clack.confirm({ message, initialValue }))
}
