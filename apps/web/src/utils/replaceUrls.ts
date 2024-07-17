export function replaceUrls(text: string, urlPathName: string, prefix: string = '', suffix: string = ''): string {
  const pattern = suffix ? `(?<url>${prefix}https://e2b-[^${suffix}]*)/${suffix}` : `(?<url>${prefix}https://e2b-.*)/$`

  return text.replaceAll(
      new RegExp(pattern, 'g'),
    (_, url) => url + suffix,
    )
    .replaceAll(
      `${prefix}https://e2b-landing-page.framer.website`,
      `${prefix}https://e2b.dev`
    )
    .replaceAll(
      `${prefix}https://e2b-blog.framer.website`,
      // The default url on framer does not have /blog in the path but the custom domain does,
      // so we need to handle this explicitly.
      urlPathName === '/'
        ? `${prefix}https://e2b.dev/blog`
        : `${prefix}https://e2b.dev`
    )
    .replaceAll(
      `${prefix}https://e2b-changelog.framer.website`,
      // The default url on framer does not have /changelog in the path but the custom domain does,
      // so we need to handle this explicitly.
      urlPathName === '/'
        ? `${prefix}https://e2b.dev/changelog`
        : `${prefix}https://e2b.dev`
    )
}