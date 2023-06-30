import type { useRepositories } from 'hooks/useRepositories'

export interface RepoSetup {
  fullName: string
  repositoryID: number
  installationID: number
  defaultBranch: string
  branches?: string[]
  url: string
  owner: string
  repo: string
}

export type Repos = ReturnType<typeof useRepositories>['repos']
