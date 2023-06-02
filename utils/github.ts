import { openPopupModal } from 'utils/popupModal'

export interface GitHubAccount {
  name: string
  isOrg: boolean
  installationID: number
}

export function configureGitHubApp() {
  const url = new URL('https://github.com/apps/e2b-for-github/installations/new')
  openPopupModal(url)
}
