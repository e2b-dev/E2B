export function parseRepoName(fullName: string) {
  const [owner, repo] = fullName.split('/')
  return { owner, repo }
}
