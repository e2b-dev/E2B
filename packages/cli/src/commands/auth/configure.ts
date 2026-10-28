import * as commander from 'commander'
import * as chalk from 'chalk'

import {
  USER_CONFIG_PATH,
  getConfigRefreshTimestamp,
  getUserConfig,
  writeUserConfig,
} from 'src/user'
import { ensureUserConfig } from 'src/api'
import { createApiKey, deleteApiKey, listProjects, Project } from 'src/projects'
import { ensureValidAccessToken } from 'src/utils/token-refresh'
import { asBold, asFormattedTeam } from '../../utils/format'

export const configureCommand = new commander.Command('configure')
  .description('configure user')
  .action(async () => {
    const inquirer = await import('inquirer')

    console.log('Configuring user...\n')

    // A file that exists but fails validation counts as signed out too —
    // getUserConfig returns null for it (and prints the deprecation message).
    if (!getUserConfig()) {
      console.log('No user config found, run `e2b auth login` to log in first.')
      return
    }

    // ensureValidAccessToken may refresh tokens and write them to disk.
    // Re-read the config afterwards so we persist the refreshed tokens
    // instead of overwriting them with stale in-memory copies.
    const accessToken = await ensureValidAccessToken()
    const userConfig = ensureUserConfig()

    const projects = await listProjects(accessToken)

    const project: Project = (
      await inquirer.default.prompt([
        {
          name: 'project',
          message: chalk.default.underline('Select project'),
          type: 'list',
          pageSize: 50,
          choices: projects.map((project) => ({
            name: asFormattedTeam(project, userConfig.projectId),
            value: project,
          })),
        },
      ])
    )['project']

    const apiKey = await createApiKey(accessToken, project)
    writeUserConfig(USER_CONFIG_PATH, {
      ...userConfig,
      version: 3,
      projectName: project.name,
      projectId: project.id,
      projectApiKey: apiKey.key,
      project_api_key_id: apiKey.id,
      project_domain: project.domain,
      last_refresh: getConfigRefreshTimestamp(),
    })
    // Only after the new key is saved, so the CLI is never left without one.
    if (userConfig.version === 3) await deleteApiKey(accessToken, userConfig)

    console.log(`Project ${asBold(project.name)} (${project.id}) selected.\n`)
  })
