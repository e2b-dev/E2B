const fs = require('fs')
const path = require('path')

function walkDir(dirName, dir, basePath = '', depth = 1) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })

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
          if (depth === 1) {
            route.href = '.' + relativePath
            route.links = links
          } else if (depth === 2) {
            route.href = '/docs/api-reference/' + relativePath
            const mdxFilePath = path.join(childPath, 'page.mdx')
            console.log(`Generating ${mdxFilePath}`)
            const mdxContent = `# ${dirName} ${entryName}\n\n${links
              .map(
                (link) =>
                  `- [${
                    link.title.charAt(0).toUpperCase() +
                    link.title.slice(1).toLowerCase()
                  }](./${entryName}/${link.title})`
              )
              .join('\n')}`
            fs.writeFileSync(mdxFilePath, mdxContent)
          }
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

  return walkDir('api-reference', apiRefPath)
}

const apiRefRoutes = generateApiRefRoutes()

fs.writeFileSync(
  path.join(__dirname, './src/components/Navigation/apiRefRoutes.json'),
  JSON.stringify(apiRefRoutes, null, 2)
)

console.log('API reference routes generated successfully.')
