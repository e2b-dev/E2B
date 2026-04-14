import { Sandbox } from '../dist/index.mjs'

const MB = 1024 * 1024

function logMemory(label: string) {
  const mem = process.memoryUsage()
  console.log(
    `[${label}] heapUsed: ${(mem.heapUsed / MB).toFixed(1)} MB, heapTotal: ${(mem.heapTotal / MB).toFixed(1)} MB, rss: ${(mem.rss / MB).toFixed(1)} MB`
  )
}

async function main() {
  const apiKey = process.env.E2B_API_KEY
  if (!apiKey) {
    console.error('E2B_API_KEY env var is required')
    process.exit(1)
  }

  logMemory('before sandbox')

  const sandbox = await Sandbox.create({ apiKey })
  console.log(`Sandbox created: ${sandbox.sandboxId}`)
  logMemory('after sandbox create')

  // Generate ~50MB of stdout to trigger O(n²) memory amplification
  // Use start() + reading .stdout in callback to force V8 string flattening
  const stdoutSizeMB = 200
  console.log(`Running command to generate ~${stdoutSizeMB}MB of stdout...`)
  console.log(
    'Reading .stdout in callback to force V8 string flattening (simulates readLines indexOf behavior)...'
  )

  const startTime = Date.now()

  // Track peak memory during execution
  let peakHeap = 0
  let peakRss = 0
  let chunkCount = 0
  const memInterval = setInterval(() => {
    const mem = process.memoryUsage()
    if (mem.heapUsed > peakHeap) peakHeap = mem.heapUsed
    if (mem.rss > peakRss) peakRss = mem.rss
  }, 50)

  try {
    const cmd = await sandbox.commands.start(
      `python3 -c "
import sys
line = 'x' * 1000 + '\\n'
for _ in range(${stdoutSizeMB * 1000}):
    sys.stdout.write(line)
sys.stdout.flush()
"`,
      {
        timeout: 600,
        onStdout: () => {
          chunkCount++
        },
      }
    )
    const result = await cmd.wait()

    clearInterval(memInterval)
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

    // Final memory check
    const finalMem = process.memoryUsage()
    if (finalMem.heapUsed > peakHeap) peakHeap = finalMem.heapUsed
    if (finalMem.rss > peakRss) peakRss = finalMem.rss

    console.log(`\nCommand completed in ${elapsed}s`)
    console.log(`stdout length: ${(result.stdout.length / MB).toFixed(1)} MB`)
    console.log(`chunks received: ${chunkCount}`)
    console.log(`exit code: ${result.exitCode}`)
    logMemory('after command')
    console.log(`Peak heapUsed: ${(peakHeap / MB).toFixed(1)} MB`)
    console.log(`Peak RSS: ${(peakRss / MB).toFixed(1)} MB`)
    console.log(
      `Memory amplification: ${(peakHeap / (stdoutSizeMB * 1_000_000)).toFixed(1)}x`
    )
  } catch (e) {
    clearInterval(memInterval)
    console.error('Command failed:', e)
    logMemory('after error')
    console.log(`Peak heapUsed: ${(peakHeap / MB).toFixed(1)} MB`)
    console.log(`Peak RSS: ${(peakRss / MB).toFixed(1)} MB`)
  } finally {
    await sandbox.kill()
  }
}

main().catch(console.error)
