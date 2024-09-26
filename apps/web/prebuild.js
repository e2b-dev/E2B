const fs = require('fs')
const path = require('path')

function walkDir(dir, basePath = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  return entries
    .map((entry) => {
      const relativePath = path.join(basePath, entry.name)

      if (entry.isDirectory()) {
        let route = { title: entry.name }
        const links = walkDir(path.join(dir, entry.name), relativePath)
        if (links.length > 0) {
          route.links = links
        } else {
          route.href = '/' + relativePath
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

  return walkDir(apiRefPath)
}

const apiRefRoutes = generateApiRefRoutes()

fs.writeFileSync(
  path.join(__dirname, './src/components/Navigation/apiRefRoutes.json'),
  JSON.stringify(apiRefRoutes, null, 2)
)

console.log('API reference routes generated successfully.')
