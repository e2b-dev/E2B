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
    title = title.replace('_sync', ' sync')
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
                const moduleHierarchy = hierarchy[entryName][version][module]
                const hasNestedModules =
                  moduleHierarchy !== null &&
                  Object.keys(moduleHierarchy).length > 0

                // Get the main module's submodules (headings from the module's own page.mdx)
                const mainModuleSubModules = getSubModules(
                  entryName,
                  `/docs/sdk-reference/${entryName}/${version}/${module}`,
                  path.join(
                    __dirname,
                    `./src/app/(docs)/docs/sdk-reference/${entryName}/${version}/${module}`
                  )
                )

                // If there are nested modules, add them after the main module's content
                const moduleLinks = hasNestedModules
                  ? [
                      ...(mainModuleSubModules || []),
                      ...Object.keys(moduleHierarchy).map((nestedModule) => {
                        return {
                          title: formatModuleTitle(nestedModule),
                          href: `/docs/sdk-reference/${entryName}/${version}/${module}/${nestedModule}`,
                          links: getSubModules(
                            entryName,
                            `/docs/sdk-reference/${entryName}/${version}/${module}/${nestedModule}`,
                            path.join(
                              __dirname,
                              `./src/app/(docs)/docs/sdk-reference/${entryName}/${version}/${module}/${nestedModule}`
                            )
                          ),
                        }
                      }),
                    ]
                  : mainModuleSubModules

                return {
                  title: formatModuleTitle(module),
                  href: `/docs/sdk-reference/${entryName}/${version}/${module}`,
                  links: moduleLinks,
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

    if (!process.cwd().endsWith('/apps/web')) {
      throw new Error('Not running from apps/web directory')
    }

    const pattern = 'src/app/\\(docs\\)/docs/**/page.mdx'

    let mdxFiles = []
    let patternsWithResults = []

    const files = await fg(pattern, {
      cwd: process.cwd(),
      absolute: true,
    })

    console.log(`Pattern: ${pattern}, Found: ${files.length} files`)

    if (files.length > 0) {
      mdxFiles.push(...files)
      patternsWithResults.push(pattern)
    }

    console.log(
      `Found ${
        mdxFiles.length
      } total files using patterns: ${patternsWithResults.join(', ')}`
    )

    if (mdxFiles.length === 0) {
      throw new Error(
        `No page.mdx files found with any pattern. Pattern: ${pattern}`
      )
    }

    const docsPages = []

    for (const filePath of mdxFiles) {
      const docsMatch =
        filePath.match(/\/app\/\(docs\)\/docs\/(.*)\/page\.mdx$/) ||
        filePath.match(/\/app\/\(docs\)\/docs\/page\.mdx$/)

      if (!docsMatch) {
        throw new Error(`Unexpected file path format: ${filePath}`)
      }

      const pathname = docsMatch[1] || ''
      const normalizedPath = `/docs${pathname ? `/${pathname}` : ''}`
      const url = `https://e2b.dev${normalizedPath}`

      docsPages.push({
        url,
        priority: 0.8,
      })
    }

    const filteredPages = docsPages.filter(
      (entry) => !entry.url.includes('/docs/legacy')
    )

    console.log(`Generated ${filteredPages.length} sitemap entries`)
    const finalEntries = filteredPages.sort((a, b) =>
      a.url.localeCompare(b.url)
    )

    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${finalEntries
  .map(
    (entry) => `  <url>
    <loc>${entry.url}</loc>
    <changefreq>weekly</changefreq>
    <priority>${entry.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`

    const outputPath = path.join(process.cwd(), 'public', 'sitemap.xml')
    fs.writeFileSync(outputPath, sitemapXml)

    console.log(`✅ Sitemap generated successfully: ${outputPath}`)
    console.log(`📊 Total entries: ${finalEntries.length}`)
  } catch (error) {
    console.error('Error generating sitemap:', error.message)
    throw error
  }
}

generateSitemap().catch(console.error)
