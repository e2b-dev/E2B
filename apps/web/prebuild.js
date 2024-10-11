const fs = require('fs')
const path = require('path')

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

function walkDir(dirName, dir, basePath = '', depth = 1) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const parentDirName = path.basename(path.dirname(dir))

  return entries
    .map((entry) => {
      const relativePath = path.join(basePath, entry.name)

      if (entry.isDirectory()) {
        let route = {
          title: depth === 1 ? entry.name.toLocaleUpperCase() : entry.name,
        }
        const entryName = entry.name
        const childPath = path.join(dir, entry.name)
        const links = walkDir(entryName, childPath, relativePath, depth + 1)

        if (links.length > 0) {
          route.href = '/docs/api-reference/' + relativePath
          if (depth === 2) {
            // module level
            const mdxFilePath = path.join(dir, 'page.mdx')

            let mdxContent = `# ${dirName}\n\n## ${entryName}\n\n${links
              .map(
                (link) =>
                  `- [${
                    link.title.charAt(0).toUpperCase() +
                    link.title.slice(1).toLowerCase()
                  }](./${dirName}/${entryName}/${link.title})`
              )
              .join('\n')}`

            if (
              hierarchy[dirName] &&
              Object.keys(hierarchy[dirName]).length > 1
            ) {
              const versions = Object.keys(hierarchy[dirName])
              const versionLinks = `${versions
                .map(
                  (version) =>
                    `<a href="/docs/api-reference/${dirName}/${version}" class="version-link">[${version}]</a>`
                )
                .join('\n  ')}`

              mdxContent = `${versionLinks}\n\n\n${mdxContent}`
            }

            fs.writeFileSync(mdxFilePath, mdxContent)
          }
        }

        if (depth === 3) {
          // version level
          const modules = Object.keys(hierarchy[parentDirName][dirName])

          let mdxContent = `# ${parentDirName.toLocaleUpperCase()} ${dirName}\n\n${modules
            .map(
              (module) =>
                `- [${
                  module.charAt(0).toUpperCase() + module.slice(1).toLowerCase()
                }](./${dirName}/${module})`
            )
            .join('\n')}`

          const mdxFilePath = path.join(dir, 'page.mdx')
          fs.writeFileSync(mdxFilePath, mdxContent)
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
  console.log('hierarchy', hierarchy)

  const routes = walkDir('api-reference', apiRefPath)
  return routes
}

const apiRefRoutes = [
  {
    title: 'References',
    links: generateApiRefRoutes(),
  },
]

fs.writeFileSync(
  path.join(__dirname, './src/components/Navigation/apiRefRoutes.json'),
  JSON.stringify(apiRefRoutes, null, 2)
)

console.log('API reference routes generated successfully.')
