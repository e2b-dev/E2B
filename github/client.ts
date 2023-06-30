import { getGHInstallationClient } from './installationClient'
import { getGHUserClient } from './userClient'

export type GitHubClient = ReturnType<typeof getGHUserClient | typeof getGHInstallationClient>
