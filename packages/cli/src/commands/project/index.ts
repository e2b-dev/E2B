import * as commander from '@commander-js/extra-typings'

import { currentProject, envAccessToken, projectId, requireMe } from 'src/api'
import { Format, parseFormat } from 'src/options'
import { asBold, asFormattedError } from 'src/utils/format'
import { renderTable } from 'src/utils/table'
import { updateUserConfig } from 'src/utils/token-refresh'
import {
  allProjects,
  blockedWarning,
  defaultProject,
  findProject,
  findWorkspace,
  Me,
  pickProject,
  Project,
  ProjectEntry,
  ProjectStatus,
} from 'src/workspaces'

const workspaceOption = (purpose: string) =>
  new commander.Option(
    '-w, --workspace <workspace>',
    `${purpose}: its ID, wrk_ ID or name`
  )

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

/**
 * The project commands run in: the current one if `me` lists it; with
 * `E2B_ACCESS_TOKEN` and no `E2B_PROJECT_ID`, the token's default project.
 */
function resolveCurrent(me: Me): ProjectEntry {
  const current = currentProject()
  if (current) return findProject(me, current)
  if (envAccessToken) return defaultProject(me)
  throw new Error(
    `No project selected. Run ${asBold('e2b project use <project>')}.`
  )
}

function findCurrent(me: Me): ProjectEntry | undefined {
  try {
    return resolveCurrent(me)
  } catch {
    return undefined
  }
}

const listCommand = new commander.Command('list')
  .description('list the projects you can access')
  .alias('ls')
  .addOption(workspaceOption('only list projects in this workspace'))
  .addOption(formatOption)
  .action(async (opts) => {
    try {
      const me = await requireMe()

      let entries = allProjects(me)
      if (opts.workspace) {
        const workspace = findWorkspace(me, opts.workspace)
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
  .description(
    'set the project commands run in by default; without a project, pick one'
  )
  .argument('[project]', 'the project: its ID, prj_ ID, slug or name')
  .addOption(workspaceOption('the workspace to pick from or look in'))
  .action(async (ref, opts) => {
    try {
      if (envAccessToken) {
        fail(
          `${asBold('E2B_ACCESS_TOKEN')} is set, so the stored project is not used. Choose the project with ${asBold(
            'E2B_PROJECT_ID'
          )} instead.`
        )
      }
      const me = await requireMe()
      const workspace = opts.workspace
        ? findWorkspace(me, opts.workspace)
        : undefined
      let entry: ProjectEntry
      if (ref) {
        entry = findProject(me, ref, workspace)
      } else {
        if (!process.stdin.isTTY) {
          fail(
            `Pass the project to use: ${asBold('e2b project use <project>')}.`
          )
        }
        entry = await pickProject(me, {
          message: 'Select project',
          selectedId: findCurrent(me)?.project.id,
          workspace,
        })
      }
      const { project, workspace: owner } = entry
      if (project.status !== ProjectStatus.Active) {
        fail(
          `Project ${project.name} is ${project.status} and can't be used. Pick an active project from ${asBold(
            'e2b project list'
          )}, or try again once it is active.`
        )
      }
      const warning = blockedWarning(entry)
      if (warning) console.warn(warning)

      await updateUserConfig({
        projectId: project.id,
        projectName: project.name,
        projectDomain: project.control_plane_domain,
      })
      console.log(
        `Now using project ${asBold(project.name)} (${project.public_id}) in workspace ${asBold(owner.name)}.`
      )

      if (projectId) {
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
  .description('show the project commands run in')
  .addOption(formatOption)
  .action(async (opts) => {
    try {
      const { project, workspace } = resolveCurrent(await requireMe())

      if (opts.format === Format.JSON) {
        console.log(
          JSON.stringify(
            {
              ...project,
              workspace_name: workspace.name,
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
