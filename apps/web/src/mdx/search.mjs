import { slugifyWithCounter } from '@sindresorhus/slugify'
import glob from 'fast-glob'
import * as fs from 'fs'
import { toString } from 'mdast-util-to-string'
import * as path from 'path'
import { remark } from 'remark'
import remarkMdx from 'remark-mdx'
import semver from 'semver'
import { createLoader } from 'simple-functional-loader'
import { filter } from 'unist-util-filter'
import { SKIP, visit } from 'unist-util-visit'
import * as url from 'url'

const __filename = url.fileURLToPath(import.meta.url)
const processor = remark().use(remarkMdx).use(extractSections)
const slugify = slugifyWithCounter()
const SDK_REFERENCE_PATTERN = /docs\/sdk-reference\/([^/]+)\/v(\d+\.\d+\.\d+)\//

function isObjectExpression(node) {
  return (
    node.type === 'mdxTextExpression' &&
    node.data?.estree?.body?.[0]?.expression?.type === 'ObjectExpression'
  )
}

function excludeObjectExpressions(tree) {
  return filter(tree, (node) => !isObjectExpression(node))
}

function extractSections() {
  return (tree, { sections }) => {
    slugify.reset()

    visit(tree, (node) => {
      if (
        node.type === 'heading' ||
        node.type === 'paragraph' ||
        node.type === 'code'
      ) {
        let content
        if (node.type === 'code') {
          // Format code blocks with language for better context
          content = `Code (${node.lang || 'text'}): ${node.value}`
        } else {
          content = toString(excludeObjectExpressions(node))
        }

        if (node.type === 'heading' && node.depth <= 2) {
          let hash = node.depth === 1 ? null : slugify(content)
          sections.push([content, hash, []])
        } else {
          sections.at(-1)?.[2].push(content)
        }
        return SKIP
      }
    })
  }
}

function parseSdkReference(file) {
  const match = file.match(SDK_REFERENCE_PATTERN)
  if (!match) return null
  const [, packageName, version] = match
  return { packageName, version }
}

function getLatestSdkVersions(files) {
  // Extract SDK reference files with versions
  const versionsByPackage = new Map()

  for (const file of files) {
    const parsed = parseSdkReference(file)
    if (parsed) {
      const { packageName, version } = parsed
      if (!versionsByPackage.has(packageName)) {
        versionsByPackage.set(packageName, [])
      }
      versionsByPackage.get(packageName).push(version)
    }
  }

  // Find the latest version for each package
  const latestVersions = new Map()
  for (const [packageName, versions] of versionsByPackage.entries()) {
    const sortedVersions = versions
      .filter((v) => semver.valid(v))
      .sort((a, b) => semver.rcompare(a, b))

    if (sortedVersions.length > 0) {
      latestVersions.set(packageName, sortedVersions[0])
      console.log(`Latest version for ${packageName}: ${sortedVersions[0]}`)
    }
  }

  return latestVersions
}

// eslint-disable-next-line import/no-anonymous-default-export
export default function (nextConfig = {}) {
  let cache = new Map()

  return Object.assign({}, nextConfig, {
    webpack(config, options) {
      config.module.rules.push({
        test: __filename,
        use: [
          createLoader(function () {
            let appDir = path.resolve('./src/app')
            this.addContextDependency(appDir)

            console.log('Starting MDX processing for search...')

            let files = glob.sync('**/*.mdx', { cwd: appDir })
            // Exclude legacy docs
            files = files.filter((file) => !file.includes('docs/legacy'))

            // Get latest SDK versions
            const latestSdkVersions = getLatestSdkVersions(files)

            // Filter to include only latest SDK versions
            files = files.filter((file) => {
              const parsed = parseSdkReference(file)
              if (parsed) {
                return (
                  latestSdkVersions.get(parsed.packageName) === parsed.version
                )
              }
              return true
            })

            let data = files.map((file, index, arr) => {
              console.log(
                `Processing MDX file ${index + 1}/${arr.length}: ${file}`
              )

              let url = '/' + file.replace(/(^|\/)page\.mdx$/, '')
              let mdx = fs.readFileSync(path.join(appDir, file), 'utf8')

              let sections = []

              if (cache.get(file)?.[0] === mdx) {
                sections = cache.get(file)[1]
              } else {
                let vfile = { value: mdx, sections }
                processor.runSync(processor.parse(vfile), vfile)
                cache.set(file, [mdx, sections])
              }

              // Determine badge for SDK reference content
              let badge = undefined
              const parsed = parseSdkReference(file)
              if (parsed) {
                badge = `${parsed.packageName} v${parsed.version}`
              }

              return { url, sections, badge }
            })

            // When this file is imported within the application
            // the following module is loaded:
            return `
              import FlexSearch from 'flexsearch'

              let sectionIndex = new FlexSearch.Document({
                tokenize: 'full',
                document: {
                  id: 'url',
                  index: 'content',
                  store: ['title', 'pageTitle', 'preview', 'badge'],
                },
                context: {
                  resolution: 9,
                  depth: 2,
                  bidirectional: true
                }
              })

              let data = ${JSON.stringify(data)}

              for (let { url, sections, badge } of data) {
                // Exclude api-reference but include sdk-reference (latest versions only)
                const isApiReference = url.includes('docs/api-reference')

                if (isApiReference) {
                  continue
                }

                for (let [title, hash, content] of sections) {
                  sectionIndex.add({
                    url: url + (hash ? ('#' + hash) : ''),
                    title,
                    content: [title, ...content].join('\\n'),
                    pageTitle: hash ? sections[0][0] : undefined,
                    preview: content.join('\\n'),
                    badge: badge,
                  })
                }
              }

              console.log('MDX processing complete. Search index populated.')

              export function search(query, options = {}) {
                let result = sectionIndex.search(query, {
                  ...options,
                  enrich: true,
                })
                if (result.length === 0) {
                  return []
                }
                return result[0].result.map((item) => ({
                  url: item.id,
                  title: item.doc.title,
                  pageTitle: item.doc.pageTitle,
                  preview: item.doc.preview,
                  badge: item.doc.badge,
                }))
              }
            `
          }),
        ],
      })

      if (typeof nextConfig.webpack === 'function') {
        return nextConfig.webpack(config, options)
      }

      return config
    },
  })
}
