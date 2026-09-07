import * as commander from 'commander'
import { defaultBuildLogger, Template } from 'e2b'

import { client, ensureAPIKey } from 'src/api'
import { handleE2BRequestError } from '../../utils/errors'
import {
  asBold,
  asFormattedError,
  asLocal,
  asPrimary,
} from '../../utils/format'

const buildStatusPollFrequencyMs = 2_000

/**
 * Rebuild a template with the host's current envd. This calls the server-side
 * refresh-envd endpoint, which derives a new build FROM the template's own
 * latest ready build (base layer cached, only the envd binary swapped) and
 * inherits the source build's specs and alias in place. Then it streams build
 * logs until the new build is ready.
 */
async function refreshEnvd(templateID: string) {
  ensureAPIKey()

  const res = await client.api.POST('/v2/templates/{templateID}/refresh-envd', {
    params: { path: { templateID } },
  })
  handleE2BRequestError(res, 'Error requesting envd refresh')

  const { buildID, fromEnvdVersion, aliases } = res.data
  const name = aliases && aliases.length > 0 ? aliases[0] : templateID

  console.log(
    `\nRefreshing envd for ${asBold(name)} (from v${fromEnvdVersion}); rebuilding...\n`
  )

  const onLog = defaultBuildLogger()
  let logsOffset = 0
  // Poll the existing build status endpoint until the derived build settles.
  // The status endpoint returns at most 100 log entries per call, so keep
  // draining after a terminal status before deciding the outcome.
  for (;;) {
    const status = await Template.getBuildStatus(
      { templateId: templateID, buildId: buildID },
      { logsOffset }
    )
    logsOffset += status.logEntries.length
    status.logEntries.forEach(onLog)

    if (status.status === 'ready') {
      if (status.logEntries.length > 0) continue
      break
    }
    if (status.status === 'error') {
      if (status.logEntries.length > 0) continue
      console.error(
        asFormattedError(status.reason?.message ?? 'Template build failed')
      )
      process.exit(1)
    }

    await new Promise((r) => setTimeout(r, buildStatusPollFrequencyMs))
  }

  console.log(
    `\n✅ ${asBold(name)} rebuilt with the current envd.\n\n   Confirm the binary changed: start a sandbox from ${asLocal(
      name
    )}, then run ${asPrimary('/usr/bin/envd -version')}.`
  )
}

export const rebuildCommand = new commander.Command('rebuild')
  .description(
    'rebuild a template with the current envd, keeping its specs and alias. Useful for old templates whose baked-in envd is too old for newer features (e.g. volume mounts need envd >= 0.5.14).'
  )
  .argument(
    '<template>',
    'template id or alias to rebuild. Its specs and alias are inherited from the latest ready build.'
  )
  .option(
    '--refresh-envd',
    "swap in the host's current envd binary (the only rebuild mode today; required)."
  )
  .alias('rb')
  .action(async (template: string, opts: { refreshEnvd?: boolean }) => {
    if (!opts.refreshEnvd) {
      console.error(
        `Nothing to rebuild. Pass ${asBold(
          '--refresh-envd'
        )} to rebuild the template with the current envd.`
      )
      process.exit(1)
    }

    try {
      await refreshEnvd(template)
    } catch (err: any) {
      console.error(asFormattedError(err.message))
      process.exit(1)
    }
  })
