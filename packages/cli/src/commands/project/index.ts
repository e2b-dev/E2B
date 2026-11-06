import * as commander from '@commander-js/extra-typings'

import { currentProject, requireMe } from 'src/api'
import { Format, parseFormat, projectOption } from 'src/options'
import { asBold, asFormattedError } from 'src/utils/format'
import { renderTable } from 'src/utils/table'
import { updateUserConfig } from 'src/utils/token-refresh'
import {
  allProjects,
  blockedWarning,
  findProject,
  Me,
  Project,
  ProjectEntry,
} from 'src/workspaces'

const formatOption = new commander.Option(
  '-f, --format <format>',
  'output format, eg. json, pretty'
)
  .argParser(parseFormat)
  .default(Format.PRETTY)

function fail(err: unknown): never {
  console.error(
    asFormattedError(err instanceof Error ? err.message : String(err))
  )
  process.exit(1)
}

/** `active`, `provisioning`, `deleting`, or `blocked` with its reasons. */
function projectStatus({ status, blocked, block_reasons }: Project) {
  if (!blocked) return status
  return block_reasons.length
    ? `blocked (${block_reasons.join(', ')})`
    : 'blocked'
}

/** The current project, if it is one `me` lists. */
function findCurrent(me: Me): ProjectEntry | undefined {
  const current = currentProject()
  if (!current) return undefined
  try {
    return findProject(me, current.ref)
  } catch {
    return undefined
  }
}

const listCommand = new commander.Command('list')
  .description('list the projects you can access')
  .alias('ls')
  .option(
    '-w, --workspace <workspace>',
    'only list projects in this workspace: its ID, wrk_ ID or name'
  )
  .addOption(formatOption)
  .action(async (opts) => {
    try {
      const me = await requireMe()

      let entries = allProjects(me)
      if (opts.workspace) {
        const ref = opts.workspace
        const workspace = me.workspaces.find(
          (w) =>
            w.id === ref ||
            w.public_id === ref ||
            w.name.toLowerCase() === ref.toLowerCase()
        )
        if (!workspace) {
          fail(
            `Workspace "${ref}" not found. Run ${asBold('e2b workspace list')} to see your workspaces.`
          )
        }
        entries = entries.filter((e) => e.workspace.id === workspace.id)
      }
      const currentId = findCurrent(me)?.project.id

      if (opts.format === Format.JSON) {
        console.log(
          JSON.stringify(
            entries.map(({ project, workspace }) => ({
              ...project,
              workspace_name: workspace.name,
              current: project.id === currentId,
            })),
            null,
            2
          )
        )
        return
      }

      if (!entries.length) {
        console.log('No projects found')
        return
      }
      renderTable(entries, [
        {
          header: 'Current',
          value: ({ project }) => (project.id === currentId ? '*' : ''),
        },
        { header: 'Project ID', value: ({ project }) => project.public_id },
        { header: 'Name', value: ({ project }) => project.name },
        { header: 'Workspace', value: ({ workspace }) => workspace.name },
        { header: 'Region', value: ({ project }) => project.region },
        { header: 'Status', value: ({ project }) => projectStatus(project) },
      ])
    } catch (err) {
      fail(err)
    }
  })

const useCommand = new commander.Command('use')
  .description('set the project commands run in by default')
  .argument('<project>', 'the project: its ID, prj_ ID, slug or name')
  .action(async (ref) => {
    try {
      const entry = findProject(await requireMe(), ref)
      const { project, workspace } = entry
      if (project.status !== 'active') {
        fail(`Project ${project.name} is ${project.status} and can't be used.`)
      }
      const warning = blockedWarning(entry)
      if (warning) console.warn(warning)

      await updateUserConfig({
        projectId: project.id,
        projectName: project.name,
        projectDomain: project.control_plane_domain,
      })
      console.log(
        `Now using project ${asBold(project.name)} (${project.public_id}) in workspace ${asBold(workspace.name)}.`
      )

      const override = currentProject()
      if (override?.source === 'E2B_PROJECT_ID') {
        console.warn(
          `${asBold('E2B_PROJECT_ID')} is set and takes precedence over the selected project.`
        )
      }
      if (process.env.E2B_API_KEY) {
        console.warn(
          `${asBold('E2B_API_KEY')} is set: commands use the API key's project instead.`
        )
      }
    } catch (err) {
      fail(err)
    }
  })

const infoCommand = new commander.Command('info')
  .description('show the current project, or the one passed with --project')
  .addOption(projectOption)
  .addOption(formatOption)
  .action(async (opts) => {
    try {
      const current = currentProject()
      if (!current) {
        fail(`No project selected. Run ${asBold('e2b project use <project>')}.`)
      }
      const { project, workspace } = findProject(await requireMe(), current.ref)

      if (opts.format === Format.JSON) {
        console.log(
          JSON.stringify(
            {
              ...project,
              workspace_name: workspace.name,
              selected_by: current.source,
            },
            null,
            2
          )
        )
        return
      }

      const rows: [string, string][] = [
        ['Name', project.name],
        ['Project ID', project.public_id],
        ['UUID', project.id],
        ['Slug', project.slug],
        ['Workspace', `${workspace.name} (${workspace.public_id})`],
        ['Region', project.region],
        ['Control plane', project.control_plane_domain],
        ['Status', projectStatus(project)],
        ['Your access', project.capabilities.join(', ') || 'none'],
        [
          'Selected by',
          current.source === 'selected' ? 'e2b project use' : current.source,
        ],
      ]
      const width = Math.max(...rows.map(([label]) => label.length)) + 2
      console.log(`\nProject info for ${asBold(project.name)}:`)
      for (const [label, value] of rows) {
        console.log(`  ${`${label}:`.padEnd(width)}${value}`)
      }
    } catch (err) {
      fail(err)
    }
  })

export const projectCommand = new commander.Command('project')
  .description('work with projects')
  .alias('prj')
  .addCommand(listCommand)
  .addCommand(useCommand)
  .addCommand(infoCommand)
