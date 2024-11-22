const fs = require('fs')
const path = require('path')

const ApiRefRoutesFilePath = './src/components/Navigation/apiRefRoutes.json'

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

const filesCreated = new Set()

function formatModuleTitle(title) {
  // Replace underscore with space for _sync and _async suffixes
  if (title.endsWith('_sync')) {
    title = title.replace('_sync', '')
  } else if (title.endsWith('_async')) {
    title = title.replace('_async', ' async')
  }
  return title.charAt(0).toUpperCase() + title.slice(1).toLowerCase()
}

function toAnchorLink(title) {
  // Add dashes between words for camelCase
  title = title.replace(/([a-z])([A-Z])/g, '$1-$2')
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
      if (pkg === 'js-sdk') {
        if (line.startsWith('### ')) {
          const title = line.slice(3).trim()
          if (title) {
            subModules.push({
              title: title,
              href: href + toAnchorLink(title),
            })
          }
        }
      } else if (pkg === 'python-sdk' || pkg === 'cli') {
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
  const parentDirName = path.basename(path.dirname(dir))

  return entries
    .map((entry) => {
      const relativePath = path.join(basePath, entry.name)

      if (entry.isDirectory()) {
        let route = {
          title:
            (depth === 1 ? entry.name.toLocaleUpperCase() : entry.name) +
            ' Reference',
        }
        const entryName = entry.name
        const childPath = path.join(dir, entry.name)
        const links = buildRoutes(entryName, childPath, relativePath, depth + 1)

        if (links.length > 0) {
          route.href = '/docs/api-reference/' + relativePath
          // SDK level
          if (depth === 1) {
            const latestVersion = Object.keys(hierarchy[entryName]).reverse()[0]
            const latestModules = Object.keys(
              hierarchy[entryName][latestVersion]
            )

            route.items = latestModules.map((module) => ({
              title: formatModuleTitle(module),
              href: `/docs/api-reference/${entryName}/${latestVersion}/${module}`,
              links: getSubModules(
                entryName,
                `/docs/api-reference/${entryName}/${latestVersion}/${module}`,
                path.join(
                  __dirname,
                  `./src/app/(docs)/docs/api-reference/${entryName}/${latestVersion}/${module}`
                )
              ),
            }))
          }

          if (depth === 2) {
            const mdxFilePath = path.join(dir, 'page.mdx')
            if (filesCreated.has(mdxFilePath)) return route

            // Generate SDK version TOC markdown file
            const latestVersion = Object.keys(hierarchy[dirName]).reverse()[0]
            let mdxContent = `# ${dirName}\n\n## ${entryName}\n\n${links
              .map(
                (link) =>
                  `- [${
                    link.title.charAt(0).toUpperCase() +
                    link.title.slice(1).toLowerCase()
                  }](./${dirName}/${latestVersion}/${link.title})`
              )
              .join('\n')}`

            if (
              hierarchy[dirName] &&
              Object.keys(hierarchy[dirName]).length > 1
            ) {
              const versions = Object.keys(hierarchy[dirName]).reverse()
              const versionLinks = `<div className="versions-dropdown">
                ${versions[0]} ▼
                <div className="dropdown-content">
                ${versions
                  .slice(1)
                  .map(
                    (version) =>
                      `<a href="/docs/api-reference/${dirName}/${version}" className="version-link">${version}</a>`
                  )
                  .join('\n  ')}
                </div>
                </div>`

              mdxContent = `${versionLinks}\n\n\n${mdxContent}`
            }

            console.log('Generated TOC file:', mdxFilePath)
            fs.writeFileSync(mdxFilePath, mdxContent)
            filesCreated.add(mdxFilePath)
          }
        }

        // Version level
        if (depth === 3) {
          const mdxFilePath = path.join(dir, 'page.mdx')
          if (filesCreated.has(mdxFilePath)) return route

          // Generate modules TOC markdown file
          const modules = Object.keys(hierarchy[parentDirName][dirName])
          let mdxContent = `# ${parentDirName.toLocaleUpperCase()} ${dirName}\n\n${modules
            .map(
              (module) =>
                `- [${
                  module.charAt(0).toUpperCase() + module.slice(1).toLowerCase()
                }](./${dirName}/${module})`
            )
            .join('\n')}`

          console.log('Generated TOC file:', mdxFilePath)
          fs.writeFileSync(mdxFilePath, mdxContent)
          filesCreated.add(mdxFilePath)
        }

        return route
      }
    })
    .filter(Boolean)
}

function generateApiRefRoutes() {
  const apiRefPath = path.join(__dirname, './src/app/(docs)/docs/api-reference')

  if (!fs.existsSync(apiRefPath)) {
    return []
  }

  hierarchy = buildDirectoryHierarchy(apiRefPath)

  const routes = buildRoutes('api-reference', apiRefPath)
  return routes
}

const apiRefRoutes = generateApiRefRoutes()

fs.writeFileSync(
  path.join(__dirname, ApiRefRoutesFilePath),
  JSON.stringify(apiRefRoutes, null, 2)
)

console.log(
  '\n\nAPI reference TOCs and routes file generated successfully:\n\n'
)
console.log('routes', JSON.stringify(apiRefRoutes, null, 2), '\n\n')
