import { openPopupModal } from 'utils/popupModal'

export function configureGitHubApp() {
  const url = new URL('https://github.com/apps/e2b-for-github/installations/new')
  openPopupModal(url)
}
