/* eslint-disable @typescript-eslint/no-unused-vars, quotes */
import { mdxAnnotations } from 'mdx-annotations'
import remarkGfm from 'remark-gfm'
import { visit } from 'unist-util-visit'
import { readFile } from 'fs/promises'
import path from 'path'
import JSON5 from 'json5'
import fs from 'fs'

const lang2ext = {
  js: 'js',
  python: 'py',
}

function loadFileSnippet() {
  return async (tree) => {
    const fileLoadingPromises = []

    visit(tree, 'code', (node, _nodeIndex, parentNode) => {
      const snippet = node?.data?.hProperties?.annotation
      if (!node?.data?.hProperties?.annotation) return

      const annotation = JSON5.parse(node?.data?.hProperties?.annotation)
      if (!annotation?.snippet) return

      const snippetFileName = annotation.snippet

      if (snippet && node.value) {
        throw new Error(
          `Snippet that should be loaded from file "${snippetFileName}" has content in the markdown file already specified. Please remove the content from the markdown file."`
        )
      }

      if (snippet && node.value === '') {
        fileLoadingPromises.push(
          (async () => {
            const file = path.resolve(`./src/code/${snippetFileName}`)
            const content = await readFile(file, 'utf8')
            node.value = content.trim()
          })()
        )
      }
    })

    await Promise.all(fileLoadingPromises)
  }
}

/**
 * Process <CodeGroupAutoload /> to add code snippets for each language
 * Depends on loadFileSnippet() to load the actual code
 */
function processCodeGroupAutoload() {
  return (tree) => {
    visit(tree, 'mdxJsxFlowElement', (node) => {
      if (node.name !== 'CodeGroupAutoload') return // only process <CodeGroupAutoload />
      const { attributes, children } = node
      const attrPath = attributes.find(({ name }) => name === 'path')?.value
      if (children.length)
        throw new Error(`CodeGroupAutoload should not have children`)
      if (!attrPath)
        throw new Error(`CodeGroupAutoload should have "path" attribute`)
      node.name = `CodeGroup` // rename to <CodeGroup />
      for (const lang of [`js`, `python`]) {
        const snippetPath = `${lang}/${attrPath}.${lang2ext[lang]}`
        const fileExists = fs.existsSync(
          path.resolve(`./src/code/${snippetPath}`)
        )
        if (!fileExists) {
          console.warn(
            `CodeGroupAutoload: snippet "${attrPath}" does not exist for language "${lang}"`
          )
          continue
        }
        node.children.push({
          type: 'code',
          value: '', // loadFileSnippet() is checking for this
          lang,
          data: {
            hProperties: {
              annotation: `{ language: '${lang}', snippet: '${snippetPath}' }`,
            },
          },
        })
      }
    })
  }
}

export const remarkPlugins = [
  processCodeGroupAutoload,
  mdxAnnotations.remark,
  remarkGfm,
  loadFileSnippet,
]
