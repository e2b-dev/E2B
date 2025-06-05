const fs = require('fs')
const path = require('path')
const fg = require('fast-glob')

const sdkRefRoutesFilePath = './src/components/Navigation/sdkRefRoutes.json'

// Current directory hierarchy:
//
// {
//   'sdk-name': {
//     'version': {
//       'module': null
//     }
//   }
// }
let hierarchy = {}

function buildDirectoryHierarchy(dirPath) {
  const result = {}
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })

  entries.forEach((entry) => {
    if (entry.isDirectory()) {
      result[entry.name] = buildDirectoryHierarchy(
        path.join(dirPath, entry.name)
      )
    }
  })

  return Object.keys(result).length === 0 ? null : result
}

//const filesCreated = new Set()

function formatModuleTitle(title) {
  // Replace underscore with space for _async and remove sync from name of python-sdk modules
  if (title.endsWith('_sync')) {
    title = title.replace('_sync', '')
  } else if (title.endsWith('_async')) {
    title = title.replace('_async', ' async')
  }
  return title.charAt(0).toUpperCase() + title.slice(1).toLowerCase()
}

function toAnchorLink(title) {
  // Replace underscores with dashes
  title = title.replace(/_/g, '-')
  // Trim dashes from start and end
  title = title.replace(/^-+|-+$/g, '')
  // Remove special characters except dashes and spaces
  title = title.replace(/[^a-zA-Z0-9\- ]/g, '')
  // Add dashes between words for camelCase
  title = title
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
  return '#' + title.toLowerCase().replace(/ /g, '-')
}

function getSubModules(pkg, href, dirPath) {
  try {
    const filePath = dirPath + '/page.mdx'
    if (!fs.existsSync(filePath)) {
      return null
    }

    const content = fs.readFileSync(filePath, 'utf8')
    const lines = content.split('\n')

    const subModules = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (
        [
          'js-sdk',
          'code-interpreter-js-sdk',
          'code-interpreter-python-sdk',
          'desktop-js-sdk',
          'desktop-python-sdk',
        ].includes(pkg)
      ) {
        if (line.startsWith('### ')) {
          let title = line.slice(3).trim()
          // Remove backslashes from title
          title = title.replace(/\\/g, '')
          if (title && !title.startsWith('_')) {
            subModules.push({
              title: title,
              href: href + toAnchorLink(title),
            })
          }
        }
      }

      if (['python-sdk', 'cli', 'code-interpreter-python-sdk'].includes(pkg)) {
        if (line.startsWith('## ')) {
          const title = line.slice(2).trim()
          if (title) {
            subModules.push({
              title: title,
              href: href + toAnchorLink(title),
            })
          }
        }
      }
    }
    return subModules.length > 0 ? subModules : null
  } catch (err) {
    return null
  }
}

function buildRoutes(dirName, dir, basePath = '', depth = 1) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  // const parentDirName = path.basename(path.dirname(dir))

  return entries
    .map((entry) => {
      const relativePath = path.join(basePath, entry.name)

      if (entry.isDirectory()) {
        let route = {
          title: depth === 1 ? entry.name.toLocaleUpperCase() : entry.name,
        }
        const entryName = entry.name
        const childPath = path.join(dir, entry.name)
        const links = buildRoutes(entryName, childPath, relativePath, depth + 1)

        if (links && links.length > 0) {
          if (depth === 1) {
            const versions = Object.keys(hierarchy[entryName]).reverse()
            const versionedItems = {}
            for (const version of versions) {
              const modules = Object.keys(hierarchy[entryName][version])
              versionedItems[version] = modules.map((module) => {
                return {
                  title: formatModuleTitle(module),
                  href: `/docs/sdk-reference/${entryName}/${version}/${module}`,
                  links: getSubModules(
                    entryName,
                    `/docs/sdk-reference/${entryName}/${version}/${module}`,
                    path.join(
                      __dirname,
                      `./src/app/(docs)/docs/sdk-reference/${entryName}/${version}/${module}`
                    )
                  ),
                }
              })
            }
            route.versionedItems = versionedItems
          }

          //if (depth === 2) {
          //  const mdxFilePath = path.join(dir, 'page.mdx')
          //  if (filesCreated.has(mdxFilePath)) return route

          //  // Generate SDK version TOC markdown file
          //  const latestVersion = Object.keys(hierarchy[dirName]).reverse()[0]
          //  let mdxContent = `# ${dirName}\n\n## ${entryName}\n\n${links
          //    .map(
          //      (link) =>
          //        `- [${
          //          link.title.charAt(0).toUpperCase() +
          //          link.title.slice(1).toLowerCase()
          //        }](./${dirName}/${latestVersion}/${link.title})`
          //    )
          //    .join('\n')}`

          //  if (
          //    hierarchy[dirName] &&
          //    Object.keys(hierarchy[dirName]).length > 1
          //  ) {
          //    const versions = Object.keys(hierarchy[dirName]).reverse()
          //    const versionLinks = `<div className="versions-dropdown">
          //      ${versions[0]} ▼
          //      <div className="dropdown-content">
          //      ${versions
          //        .slice(1)
          //        .map(
          //          (version) =>
          //            `<a href="/docs/sdk-reference/${dirName}/${version}" className="version-link">${version}</a>`
          //        )
          //        .join('\n  ')}
          //      </div>
          //      </div>`

          //    mdxContent = `${versionLinks}\n\n\n${mdxContent}`
          //  }

          //  console.log('Generated TOC file:', mdxFilePath)
          //  fs.writeFileSync(mdxFilePath, mdxContent)
          //  filesCreated.add(mdxFilePath)
          //}
        }

        // Version level
        // if (depth === 3) {
        //   const mdxFilePath = path.join(dir, 'page.mdx')
        //   if (filesCreated.has(mdxFilePath)) return route

        //   // Generate modules TOC markdown file
        //   const modules = Object.keys(hierarchy[parentDirName][dirName])
        //   let mdxContent = `# ${parentDirName.toLocaleUpperCase()} ${dirName}\n\n${modules
        //     .map(
        //       (module) =>
        //         `- [${
        //           module.charAt(0).toUpperCase() + module.slice(1).toLowerCase()
        //         }](./${dirName}/${module})`
        //     )
        //     .join('\n')}`

        //   console.log('Generated TOC file:', mdxFilePath)
        //   fs.writeFileSync(mdxFilePath, mdxContent)
        //   filesCreated.add(mdxFilePath)
        // }

        return route
      }
    })
    .filter(Boolean)
}

function generatesdkRefRoutes() {
  const sdkRefPath = path.join(__dirname, './src/app/(docs)/docs/sdk-reference')

  if (!fs.existsSync(sdkRefPath)) {
    return []
  }

  hierarchy = buildDirectoryHierarchy(sdkRefPath)

  const routes = buildRoutes('sdk-reference', sdkRefPath)
  return routes
}

const sdkRefRoutes = generatesdkRefRoutes()

fs.writeFileSync(
  path.join(__dirname, sdkRefRoutesFilePath),
  JSON.stringify(sdkRefRoutes, null, 2)
)

console.log('\n\nSDK reference routes generated successfully')

// Generate sitemap
async function generateSitemap() {
  try {
    console.log('Generating sitemap...')
    console.log('Current working directory:', process.cwd())

    // Patterns to find all page.mdx files
    // Account for different possible CWDs (main repo root vs apps/web)
    const patterns = [
      'src/app/\\(docs\\)/docs/**/page.mdx',  // Subdirectories
      'src/app/\\(docs\\)/docs/page.mdx',     // Root docs page
      'apps/web/src/app/\\(docs\\)/docs/**/page.mdx',  // Subdirectories (when CWD is repo root)
      'apps/web/src/app/\\(docs\\)/docs/page.mdx'      // Root docs page (when CWD is repo root)
    ]

    let mdxFiles = []

    // Collect files from all patterns
    for (const pattern of patterns) {
      const files = await fg(pattern, {
        cwd: process.cwd(),
        absolute: true,
      })

      console.log(`Pattern: ${pattern}, Found: ${files.length} files`)

      if (files.length > 0) {
        mdxFiles.push(...files)
      }
    }

    // Remove duplicates
    mdxFiles = [...new Set(mdxFiles)]

    console.log(`Found ${mdxFiles.length} total files`)

    if (mdxFiles.length === 0) {
      console.error('Could not find any page.mdx files')
      process.exit(1)
    }

    // Convert file paths to sitemap entries
    const docsPages = mdxFiles
      .map((filePath) => {
        try {
          // Find the /docs/ segment and extract everything after it
          const docsMatch = filePath.match(/\/app\/\(docs\)\/docs\/(.*)\/page\.mdx$/) ||
                           filePath.match(/\/app\/\(docs\)\/docs\/page\.mdx$/)

          if (!docsMatch) {
            console.warn(`Unexpected file path format: ${filePath}`)
            return null
          }

          // Handle root docs page vs subdirectory pages
          let pathname = docsMatch[1] || ''

          // Normalize pathname to always start with /docs
          const normalizedPath = `/docs${pathname ? `/${pathname}` : ''}`
          const url = `https://e2b.dev${normalizedPath}`

          // Get last modified time
          const lastModified = fs.statSync(filePath).mtime.toISOString()

          return {
            url,
            lastModified,
            priority: 0.8,
          }
        } catch (error) {
          console.error(`Error processing file ${filePath}:`, error)
          return null
        }
      })
      .filter(entry => entry !== null)
      // Filter out legacy docs pages
      .filter((entry) => !entry.url.includes('/docs/legacy'))

    console.log(`Generated ${docsPages.length} sitemap entries`)

    // Deduplicate URLs, keeping the entry with highest priority
    const urlMap = new Map()
    for (const entry of docsPages) {
      const existing = urlMap.get(entry.url)
      if (!existing || (existing.priority || 0) < (entry.priority || 0)) {
        urlMap.set(entry.url, entry)
      }
    }

    const finalEntries = Array.from(urlMap.values()).sort((a, b) =>
      a.url.localeCompare(b.url)
    )

    // Generate XML sitemap
    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${finalEntries.map(entry => `  <url>
    <loc>${entry.url}</loc>
    <lastmod>${entry.lastModified}</lastmod>
    <priority>${entry.priority}</priority>
  </url>`).join('\n')}
</urlset>`

    // Write sitemap.xml to public directory (Next.js will serve it automatically)
    const outputPath = path.join(__dirname, 'public', 'sitemap.xml')
    fs.writeFileSync(outputPath, sitemapXml)

    console.log(`✅ Sitemap generated successfully: ${outputPath}`)
    console.log(`📊 Total entries: ${finalEntries.length}`)
  } catch (error) {
    console.error('Error generating sitemap:', error)
    process.exit(1)
  }
}

generateSitemap().catch(console.error)
