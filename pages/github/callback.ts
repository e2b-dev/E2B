import { useRouter } from 'next/router'
import { useEffect } from 'react'

function GitHubCallback() {
  const router = useRouter()

  useEffect(function message() {
    if (router.query.access_token) {
      if (window && window.opener) {
        window.opener.postMessage({ accessToken: router.query.access_token }, '*')
        window.close()
      }
    }
    if (router.query.installation_id) {
      if (window && window.opener) {
        window.opener.postMessage({ installationID: router.query.installation_id }, '*')
        window.close()
      }
    }
  }, [router.query.access_token, router.query.installation_id])

  return null
}

export default GitHubCallback
