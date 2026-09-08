// Build the windows-nested template from a pushed image.
//
// usage: npx tsx template.ts IMAGE NAME [--mode relaunch|live] [--cpu N] [--memory-mb N] [--skip-cache]
//
//   IMAGE  OCI reference of the image built from e2b.Dockerfile, in a registry the
//          template builder can pull from
//   NAME   template name (or name:tag)

import { Template, waitForFile } from 'e2b'

const argv = process.argv.slice(2)
const positional = argv.filter((a) => !a.startsWith('--'))
const option = (name: string) => {
  const i = argv.indexOf(`--${name}`)
  return i === -1 ? undefined : argv[i + 1]
}
const [image, name] = positional
if (!image || !name) {
  console.error(
    'usage: template.ts IMAGE NAME [--mode relaunch|live] [--cpu N] [--memory-mb N] [--skip-cache]'
  )
  process.exit(2)
}
const mode = option('mode') ?? 'relaunch'
if (mode !== 'relaunch' && mode !== 'live') {
  console.error(`unknown mode ${mode}`)
  process.exit(2)
}

const base = Template().fromImage(image).setUser('root').setWorkdir('/opt/win')
const template =
  mode === 'relaunch'
    ? base
        .runCmd('bash /opt/win/build-snapshot.sh')
        .setStartCmd(
          'python3 /opt/win/winctl.py',
          waitForFile('/opt/win/winctl.ready')
        )
    : base.setStartCmd(
        'bash /opt/win/start-live.sh',
        'python3 /opt/win/rdpcheck.py'
      )

const t0 = performance.now()
const info = await Template.build(template, name, {
  cpuCount: Number(option('cpu') ?? 8),
  memoryMB: Number(option('memory-mb') ?? 8192),
  skipCache: argv.includes('--skip-cache'),
  onBuildLogs: (entry) => console.log(entry.toString()),
})
console.log(
  `built ${name} (${mode}) templateId=${info.templateId} buildId=${info.buildId} in ${((performance.now() - t0) / 1000).toFixed(0)}s`
)
