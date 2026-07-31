export const template = 'base'

/**
 * Template that serves go-httpbin on port 8080, used as a sidecar by tests
 * that need a publicly reachable echo server — see `templates/httpbin`.
 */
export const httpbinTemplate = 'httpbin'
