import { openPopupModal } from 'utils/popupModal'

export interface GitHubAccount {
  name: string
  isOrg: boolean
  installationID: number
}

export function configureGitHubApp() {
  const url = new URL('https://github.com/apps/e2b-for-github/installations/new')

  const hostname = window.location.hostname
  const protocol = window.location.protocol
  const redirectURI = `${protocol}//${hostname}/api/github/oauth`
  url.searchParams.append('redirect_uri', redirectURI)

  openPopupModal(url)
}
