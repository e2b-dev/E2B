import { mdxAnnotations } from 'mdx-annotations'
import remarkGfm from 'remark-gfm'
import { visit } from 'unist-util-visit'
import { readFile } from 'fs/promises'
import path from 'path'
import JSON5 from 'json5'

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
            node.value = content
          })()
        )
      }
    })

    await Promise.all(fileLoadingPromises)
  }
}

export const remarkPlugins = [mdxAnnotations.remark, remarkGfm, loadFileSnippet]
