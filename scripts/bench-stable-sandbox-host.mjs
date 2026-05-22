#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { performance } from 'node:perf_hooks'
import process from 'node:process'

const require = createRequire(import.meta.url)

const args = parseArgs(process.argv.slice(2))

if (args.help) {
  printHelp()
  process.exit(0)
}

const sdk = args.sdk ?? 'js'
const route = args.route ?? 'stable'
const total = Number(args.total ?? 300)
const createConcurrency = Number(args.createConcurrency ?? total)
const execConcurrency = Number(args.execConcurrency ?? total)
const command = args.command ?? 'printf ok'
const expectedStdout = args.expectedStdout ?? 'ok'
const sandboxTimeoutMs = Number(args.sandboxTimeoutMs ?? 180_000)
const requestTimeoutMs = Number(args.requestTimeoutMs ?? 120_000)
const settleMs = Number(args.settleMs ?? 0)
const label = args.label ?? `${sdk}-${route}`

if (!['js', 'python-sync', 'python-async'].includes(sdk)) {
  throw new Error(`Unknown --sdk ${sdk}`)
}

if (!['stable', 'old', 'env'].includes(route)) {
  throw new Error(`Unknown --route ${route}`)
}

if (route === 'old' && sdk === 'js' && !args.sdkPath) {
  throw new Error('--route old requires --sdk-path pointing at an SDK build without the stable sandbox host default')
}

if (route === 'old' && sdk !== 'js' && !args.python) {
  throw new Error('--route old requires --python pointing at a Python environment without the stable sandbox host default')
}

applyRouteEnv(route)

if (sdk === 'js') {
  await runJs()
} else {
  await runPython(sdk)
}

function applyRouteEnv(route) {
  if (route === 'stable') {
    process.env.E2B_SANDBOX_URL = 'https://sandbox.e2b.app'
  } else if (route === 'old') {
    delete process.env.E2B_SANDBOX_URL
  }
}

async function runJs() {
  const sdkPath = args.sdkPath ?? '../packages/js-sdk/dist/index.mjs'
  const { Sandbox } = await import(new URL(sdkPath, import.meta.url).href)

  const sandboxes = new Array(total)
  const createRows = []
  const execRows = []
  const createSamples = []
  const execSamples = []
  const errors = new Map()

  try {
    const createSampler = setInterval(
      () => createSamples.push(socketSnapshot()),
      10
    )
    await pool(total, createConcurrency, async (idx) => {
      const started = performance.now()
      sandboxes[idx] = await Sandbox.create({
        timeoutMs: sandboxTimeoutMs,
        requestTimeoutMs,
      })
      createRows.push(performance.now() - started)
    }, 'create')
    clearInterval(createSampler)

    const created = sandboxes.filter(Boolean)
    if (settleMs) {
      console.log(JSON.stringify({ event: 'settle', ms: settleMs }))
      await new Promise((resolve) => setTimeout(resolve, settleMs))
    }

    const execStarted = performance.now()
    const execSampler = setInterval(() => execSamples.push(socketSnapshot()), 10)

    await pool(created.length, execConcurrency, async (idx) => {
      const started = performance.now()
      const res = await created[idx].commands.run(command, { requestTimeoutMs })
      const elapsed = performance.now() - started

      if (res.exitCode !== 0 || res.stdout !== expectedStdout) {
        throw new Error(
          `bad-result exit=${res.exitCode} stdout=${JSON.stringify(res.stdout)} stderr=${JSON.stringify(res.stderr)}`
        )
      }

      execRows.push(elapsed)
    }, 'exec')

    clearInterval(execSampler)
    const summary = {
      label,
      sdk,
      route,
      total,
      created: created.length,
      executed: execRows.length,
      errors,
      execWallMs: Math.round(performance.now() - execStarted),
      createPeak: peak(createSamples, 'sockets'),
      execPeak: peak(execSamples, 'sockets'),
      createMs: stats(createRows),
      execMs: stats(execRows),
    }
    printSummary(summary)

    if (errors.size || summary.created !== total || summary.executed !== summary.created) {
      process.exitCode = 1
    }
  } finally {
    await Promise.allSettled(sandboxes.filter(Boolean).map((sandbox) => sandbox.kill()))
  }

  function addError(error) {
    const key = error?.message || String(error)
    errors.set(key, (errors.get(key) || 0) + 1)
  }

  async function pool(count, concurrency, fn, event) {
    let next = 0
    let done = 0

    async function worker() {
      while (next < count) {
        const idx = next++
        try {
          await fn(idx)
        } catch (error) {
          addError(error)
        }
        done++
        if (done % Math.max(1, Math.floor(count / 6)) === 0 || done === count) {
          console.log(JSON.stringify({ event, done }))
        }
      }
    }

    await Promise.all(Array.from({ length: concurrency }, worker))
  }
}

async function runPython(sdk) {
  const python = args.python ?? 'python'
  const script = sdk === 'python-sync' ? pythonSyncScript() : pythonAsyncScript()

  const child = spawn(python, ['-c', script], {
    stdio: 'inherit',
    env: {
      ...process.env,
      BENCH_LABEL: label,
      BENCH_TOTAL: String(total),
      BENCH_CREATE_CONCURRENCY: String(createConcurrency),
      BENCH_EXEC_CONCURRENCY: String(execConcurrency),
      BENCH_COMMAND: command,
      BENCH_EXPECTED_STDOUT: expectedStdout,
      BENCH_SANDBOX_TIMEOUT_SEC: String(Math.ceil(sandboxTimeoutMs / 1000)),
      BENCH_REQUEST_TIMEOUT_SEC: String(Math.ceil(requestTimeoutMs / 1000)),
      BENCH_SETTLE_MS: String(settleMs),
    },
  })

  const code = await new Promise((resolve) => child.on('exit', resolve))
  if (code !== 0) {
    process.exit(code ?? 1)
  }
}

function socketSnapshot() {
  const handles = process._getActiveHandles?.() ?? []
  const sockets = handles.filter(
    (handle) =>
      handle?.constructor?.name === 'Socket' ||
      handle?.constructor?.name === 'TLSSocket'
  )
  const hosts = new Set()
  for (const socket of sockets) {
    const host = socket.servername ?? socket._host ?? socket.remoteAddress
    if (host) hosts.add(String(host))
  }
  return { sockets: sockets.length, hosts: hosts.size }
}

function peak(samples, socketField) {
  return samples.reduce(
    (acc, sample) => ({
      connections: Math.max(acc.connections, sample[socketField]),
      hosts: Math.max(acc.hosts, sample.hosts),
    }),
    { connections: 0, hosts: 0 }
  )
}

function stats(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const pct = (p) =>
    sorted.length
      ? Math.round(sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))])
      : null

  return {
    count: sorted.length,
    p50: pct(50),
    p90: pct(90),
    p95: pct(95),
    p99: pct(99),
    max: sorted.length ? Math.round(sorted.at(-1)) : null,
  }
}

function printSummary(summary) {
  console.log(JSON.stringify(summary, replacer, 2))
}

function replacer(_key, value) {
  if (value instanceof Map) {
    return Object.fromEntries(value)
  }
  return value
}

function parseArgs(argv) {
  const parsed = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') {
      parsed.help = true
      continue
    }
    if (!arg.startsWith('--')) {
      throw new Error(`Unexpected argument ${arg}`)
    }
    const [rawKey, rawValue] = arg.slice(2).split('=', 2)
    const key = rawKey.replace(/-([a-z])/g, (_, char) => char.toUpperCase())
    parsed[key] = rawValue ?? argv[++i]
  }
  return parsed
}

function printHelp() {
  console.log(`Usage:
  ./scripts/bench-stable-sandbox-host.mjs --sdk js --route stable --total 300
  ./scripts/bench-stable-sandbox-host.mjs --sdk python-sync --route old --python packages/python-sdk/.venv/bin/python
  ./scripts/bench-stable-sandbox-host.mjs --sdk python-async --route stable --total 500

Options:
  --sdk                  js | python-sync | python-async
  --route                stable | env, or old with an explicit old SDK path
  --total                Number of sandboxes to create and execute against
  --create-concurrency   Create concurrency, defaults to --total
  --exec-concurrency     Command execution concurrency, defaults to --total
  --sdk-path             JS SDK module path, defaults to ../packages/js-sdk/dist/index.mjs
  --python               Python executable for Python SDK runs
  --command              Command to run, defaults to "printf ok"
  --expected-stdout      Expected stdout, defaults to "ok"
  --sandbox-timeout-ms   Sandbox timeout for JS runs, defaults to 180000
  --request-timeout-ms   Request timeout for JS runs, defaults to 120000
  --settle-ms            Wait after all sandboxes are created before executing commands
  --label                Label included in JSON summary
`)
}

function pythonSharedPrelude() {
  return String.raw`
import json
import os
import time

TOTAL = int(os.environ.get("BENCH_TOTAL", "300"))
CREATE_CONCURRENCY = int(os.environ.get("BENCH_CREATE_CONCURRENCY", str(TOTAL)))
EXEC_CONCURRENCY = int(os.environ.get("BENCH_EXEC_CONCURRENCY", str(TOTAL)))
COMMAND = os.environ.get("BENCH_COMMAND", "printf ok")
EXPECTED_STDOUT = os.environ.get("BENCH_EXPECTED_STDOUT", "ok")
SANDBOX_TIMEOUT_SEC = int(os.environ.get("BENCH_SANDBOX_TIMEOUT_SEC", "180"))
REQUEST_TIMEOUT_SEC = int(os.environ.get("BENCH_REQUEST_TIMEOUT_SEC", "120"))
SETTLE_MS = int(os.environ.get("BENCH_SETTLE_MS", "0"))
LABEL = os.environ.get("BENCH_LABEL", "python")

sandboxes = [None] * TOTAL
create_rows = []
exec_rows = []
errors = {}
samples = []
sampling = False

def add_error(exc):
    key = str(exc)
    errors[key] = errors.get(key, 0) + 1

def stat(values):
    sorted_values = sorted(values)
    def pct(p):
        if not sorted_values:
            return None
        idx = min(len(sorted_values) - 1, int((p / 100) * len(sorted_values)))
        return round(sorted_values[idx])
    return {
        "count": len(sorted_values),
        "p50": pct(50),
        "p90": pct(90),
        "p95": pct(95),
        "p99": pct(99),
        "max": round(max(sorted_values)) if sorted_values else None,
    }

def origins(pool):
    conns = list(getattr(pool, "_connections", []) or [])
    hosts = set(repr(getattr(conn, "_origin", None)) for conn in conns)
    return {"connections": len(conns), "hosts": len(hosts)}

def origins_many(pools):
    conns = []
    hosts = set()
    for pool in pools:
        pool_conns = list(getattr(pool, "_connections", []) or [])
        conns.extend(pool_conns)
        hosts.update(repr(getattr(conn, "_origin", None)) for conn in pool_conns)
    return {"connections": len(conns), "hosts": len(hosts)}

def peak():
    return {
        "connections": max([sample["connections"] for sample in samples], default=0),
        "hosts": max([sample["hosts"] for sample in samples], default=0),
    }
`
}

function pythonSyncScript() {
  return `${pythonSharedPrelude()}
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from e2b import Sandbox
from e2b.sandbox_sync.commands import command as command_module

def sample_loop(pools):
    while sampling:
        samples.append(origins_many(pools))
        time.sleep(0.01)

def safe_kill(sandbox):
    try:
        sandbox.kill()
    except Exception:
        pass

def create_one(idx):
    started = time.perf_counter()
    sandbox = Sandbox.create(timeout=SANDBOX_TIMEOUT_SEC, request_timeout=REQUEST_TIMEOUT_SEC)
    sandboxes[idx] = sandbox
    create_rows.append((time.perf_counter() - started) * 1000)

def exec_one(sandbox):
    started = time.perf_counter()
    result = sandbox.commands.run(COMMAND, request_timeout=REQUEST_TIMEOUT_SEC)
    elapsed = (time.perf_counter() - started) * 1000
    exit_code = getattr(result, "exit_code", getattr(result, "exitCode", None))
    stdout = getattr(result, "stdout", None)
    stderr = getattr(result, "stderr", None)
    if exit_code != 0 or stdout != EXPECTED_STDOUT:
        raise RuntimeError(f"bad-result exit={exit_code} stdout={stdout!r} stderr={stderr!r}")
    exec_rows.append(elapsed)

exec_wall_ms = 0
try:
    with ThreadPoolExecutor(max_workers=CREATE_CONCURRENCY) as pool:
        done = 0
        for future in as_completed([pool.submit(create_one, i) for i in range(TOTAL)]):
            try:
                future.result()
            except Exception as exc:
                add_error(exc)
            done += 1
            if done % max(1, TOTAL // 6) == 0 or done == TOTAL:
                print(json.dumps({"event": "create", "done": done}), flush=True)

    created = [sandbox for sandbox in sandboxes if sandbox is not None]
    if SETTLE_MS:
        print(json.dumps({"event": "settle", "ms": SETTLE_MS}), flush=True)
        time.sleep(SETTLE_MS / 1000)

    http_pools = [
        transport.pool
        for transport in getattr(command_module, "_rpc_transports", [])
    ]
    if not http_pools and created:
        http_pools = [created[0]._transport.pool]
    sampling = True
    sampler = threading.Thread(target=sample_loop, args=(http_pools,))
    sampler.start()
    started = time.perf_counter()
    with ThreadPoolExecutor(max_workers=EXEC_CONCURRENCY) as pool:
        done = 0
        for future in as_completed([pool.submit(exec_one, sandbox) for sandbox in created]):
            try:
                future.result()
            except Exception as exc:
                add_error(exc)
            done += 1
            if done % max(1, len(created) // 6) == 0 or done == len(created):
                print(json.dumps({"event": "exec", "done": done}), flush=True)
    exec_wall_ms = (time.perf_counter() - started) * 1000
    sampling = False
    sampler.join()
finally:
    sampling = False
    created = [sandbox for sandbox in sandboxes if sandbox is not None]
    with ThreadPoolExecutor(max_workers=min(100, max(1, len(created)))) as pool:
        list(pool.map(safe_kill, created))

print(json.dumps({
    "label": LABEL,
    "sdk": "python-sync",
    "total": TOTAL,
    "created": len(created),
    "executed": len(exec_rows),
    "errors": errors,
    "execWallMs": round(exec_wall_ms),
    "execPeak": peak(),
    "createMs": stat(create_rows),
    "execMs": stat(exec_rows),
}, indent=2))

if errors or len(created) != TOTAL or len(exec_rows) != len(created):
    raise SystemExit(1)
`
}

function pythonAsyncScript() {
  return `${pythonSharedPrelude()}
import asyncio
from e2b import AsyncSandbox

async def sample_loop(pool):
    while sampling:
        samples.append(origins(pool))
        await asyncio.sleep(0.01)

async def safe_kill(sandbox):
    try:
        await sandbox.kill()
    except Exception:
        pass

async def create_one(idx, sem):
    async with sem:
        started = time.perf_counter()
        sandbox = await AsyncSandbox.create(timeout=SANDBOX_TIMEOUT_SEC, request_timeout=REQUEST_TIMEOUT_SEC)
        sandboxes[idx] = sandbox
        create_rows.append((time.perf_counter() - started) * 1000)

async def exec_one(sandbox, sem):
    async with sem:
        started = time.perf_counter()
        result = await sandbox.commands.run(COMMAND, request_timeout=REQUEST_TIMEOUT_SEC)
        elapsed = (time.perf_counter() - started) * 1000
        exit_code = getattr(result, "exit_code", getattr(result, "exitCode", None))
        stdout = getattr(result, "stdout", None)
        stderr = getattr(result, "stderr", None)
        if exit_code != 0 or stdout != EXPECTED_STDOUT:
            raise RuntimeError(f"bad-result exit={exit_code} stdout={stdout!r} stderr={stderr!r}")
        exec_rows.append(elapsed)

async def gather_with_progress(coros, event):
    done = 0
    tasks = [asyncio.create_task(coro) for coro in coros]
    for task in asyncio.as_completed(tasks):
        try:
            await task
        except Exception as exc:
            add_error(exc)
        done += 1
        if done % max(1, len(tasks) // 6) == 0 or done == len(tasks):
            print(json.dumps({"event": event, "done": done}), flush=True)

async def main():
    global sampling
    exec_wall_ms = 0
    try:
        create_sem = asyncio.Semaphore(CREATE_CONCURRENCY)
        await gather_with_progress(
            [create_one(i, create_sem) for i in range(TOTAL)],
            "create",
        )
        created = [sandbox for sandbox in sandboxes if sandbox is not None]
        if SETTLE_MS:
            print(json.dumps({"event": "settle", "ms": SETTLE_MS}), flush=True)
            await asyncio.sleep(SETTLE_MS / 1000)

        http_pool = created[0]._transport.pool if created else None
        sampling = True
        sampler = asyncio.create_task(sample_loop(http_pool))
        started = time.perf_counter()
        exec_sem = asyncio.Semaphore(EXEC_CONCURRENCY)
        await gather_with_progress(
            [exec_one(sandbox, exec_sem) for sandbox in created],
            "exec",
        )
        exec_wall_ms = (time.perf_counter() - started) * 1000
        sampling = False
        await sampler
    finally:
        sampling = False
        created = [sandbox for sandbox in sandboxes if sandbox is not None]
        await asyncio.gather(*(safe_kill(sandbox) for sandbox in created), return_exceptions=True)

    print(json.dumps({
        "label": LABEL,
        "sdk": "python-async",
        "total": TOTAL,
        "created": len(created),
        "executed": len(exec_rows),
        "errors": errors,
        "execWallMs": round(exec_wall_ms),
        "execPeak": peak(),
        "createMs": stat(create_rows),
        "execMs": stat(exec_rows),
    }, indent=2))

    if errors or len(created) != TOTAL or len(exec_rows) != len(created):
        raise SystemExit(1)

asyncio.run(main())
`
}
