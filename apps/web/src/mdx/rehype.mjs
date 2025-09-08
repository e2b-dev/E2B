/* eslint-disable @typescript-eslint/no-unused-vars */
import { slugifyWithCounter } from '@sindresorhus/slugify'
import * as acorn from 'acorn'
import { toString } from 'mdast-util-to-string'
import { mdxAnnotations } from 'mdx-annotations'
import shiki from 'shiki'
import { visit } from 'unist-util-visit'

function rehypeParseCodeBlocks() {
  return (tree) => {
    visit(tree, 'element', (node, _nodeIndex, parentNode) => {
      if (node.tagName === 'code' && node.properties.className) {
        parentNode.properties.language = node.properties.className[0]?.replace(
          /^language-/,
          ''
        )
      }
    })
  }
}

let highlighter

const elements = {
  pre({ className, style, children }) {
    // return `<pre class="${className}" style="${style}" tabindex="0">${children}</pre>` // original implementation
    return children
  },

  code({ children }) {
    // return `<code>${children}</code>` // original implementation
    return children
  },

  line({ className, children }) {
    return `<span class="${className}">${children}</span>` // no changes here
  },

  token({ style, children }) {
    return `<span style="${style}">${children}</span>` // no changes here
  },
}

// From Shiki
const FontStyle = {
  NotSet: -1,
  None: 0,
  Italic: 1,
  Bold: 2,
  Underline: 4,
}

// Custom implementation of renderToHtml from https://raw.githubusercontent.com/shikijs/shiki/main/packages/shiki/src/renderer.ts
function customRenderToHtml(lines, language) {
  function h(type = '', props = {}, children) {
    const element = elements[type]
    if (element) {
      children = children.filter(Boolean)
      return element({
        ...props,
        children: type === 'code' ? children.join('\n') : children.join(''),
      })
    }
    return ''
  }

  return h('pre', { className: 'shiki ' }, [
    h(
      'code',
      {},
      lines.map((line, index) => {
        let isE2bImport = false
        if (
          // Not perfect, but should work fine for now
          index === 0 && // Only supported on the first line
          line?.some(
            (token) =>
              token.content === 'import' &&
              token.color === 'var(--shiki-token-keyword)'
          ) && // works fine for Python and JS
          line?.some(
            (token) =>
              token.content === 'e2b' &&
              token.color === 'var(--shiki-token-text)'
          ) // works fine for Python and JS
        ) {
          isE2bImport = true // TODO: Actually use, probably to dim the line
        }

        let isHighlightComment = false
        if (
          line?.some(
            (token) =>
              token.content.includes('$HighlightLine') &&
              token.color === 'var(--shiki-token-comment)'
          )
        ) {
          isHighlightComment = true
        }

        // TODO: Maybe more interesting rules?

        const lineNumber = index + 1
        const lineOptions = []
        let lineClasses = ''

        if (isHighlightComment) {
          // Drop the token with the comment
          // TODO: Dry
          line = line.filter(
            (token) =>
              !(
                token.content.includes('$HighlightLine') &&
                token.color === 'var(--shiki-token-comment)'
              )
          )
          lineClasses += ' Code-line_highlighted'
        }

        return h(
          'line',
          {
            className: lineClasses,
            lines,
            line,
            index,
          },
          line.map((token, index) => {
            const cssDeclarations = [`color: ${token.color}`]
            if (token.fontStyle === FontStyle.Italic)
              cssDeclarations.push('font-style: italic')
            if (token.fontStyle === FontStyle.Bold)
              cssDeclarations.push('font-weight: bold')
            if (token.fontStyle === FontStyle.Underline)
              cssDeclarations.push('text-decoration: underline')

            return h(
              'token',
              {
                style: cssDeclarations.join('; '),
                tokens: line,
                token,
                index,
              },
              [escapeHtml(token.content)]
            )
          })
        )
      })
    ),
  ])
}

const htmlEscapes = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

function escapeHtml(html) {
  return html.replace(/[&<>"']/g, (chr) => htmlEscapes[chr])
}

function rehypeShiki() {
  return async (tree) => {
    highlighter =
      highlighter ?? (await shiki.getHighlighter({ theme: 'css-variables' }))

    visit(tree, 'element', (node) => {
      if (node.tagName === 'pre' && node.children[0]?.tagName === 'code') {
        const { language } = node.properties
        let codeNode = node.children[0]
        let textNode = codeNode.children[0]
        const code = textNode.value

        node.properties.code = code // TODO: Explain why we need this

        if (language) {
          let tokens = highlighter.codeToThemedTokens(code, language)

          // Custom renderer for out magic comments
          // Normally, we would call textNode.value = shiki.renderToHtml(tokens)
          // Tokens are in format [{ content: 'const', color: 'var(--shiki-token-keyword)' }, ...]
          // We don't get full AST here, so when we wanna target code comments for our styling, we need to find them by matching `color`
          textNode.value = customRenderToHtml(tokens, language)
        }
      }
    })
  }
}

function rehypeSlugify() {
  return (tree) => {
    let slugify = slugifyWithCounter()
    visit(tree, 'element', (node) => {
      if (node.tagName === 'h2' && !node.properties.id) {
        node.properties.id = slugify(toString(node))
      }
      if (node.tagName === 'h3' && !node.properties.id) {
        node.properties.id = slugify(toString(node))
      }
    })
  }
}

function rehypeAddMDXExports(getExports) {
  return (tree) => {
    let exports = Object.entries(getExports(tree))

    for (let [name, value] of exports) {
      for (let node of tree.children) {
        if (
          node.type === 'mdxjsEsm' &&
          new RegExp(`export\\s+const\\s+${name}\\s*=`).test(node.value)
        ) {
          return
        }
      }

      let exportStr = `export const ${name} = ${value}`

      tree.children.push({
        type: 'mdxjsEsm',
        value: exportStr,
        data: {
          estree: acorn.parse(exportStr, {
            sourceType: 'module',
            ecmaVersion: 'latest',
          }),
        },
      })
    }
  }
}

function getSections(node) {
  let sections = []

  for (let child of node.children ?? []) {
    if (
      child.type === 'element' &&
      (child.tagName === 'h2' || child.tagName === 'h3')
    ) {
      sections.push(`{
        title: ${JSON.stringify(toString(child))},
        id: ${JSON.stringify(child.properties.id)},
        ...${child.properties.annotation}
      }`)
    } else if (child.children) {
      sections.push(...getSections(child))
    }
  }

  return sections
}

export const rehypePlugins = [
  mdxAnnotations.rehype,
  rehypeParseCodeBlocks,
  rehypeShiki,
  rehypeSlugify,
  [
    rehypeAddMDXExports,
    (tree) => ({
      sections: `[${getSections(tree).join()}]`,
    }),
  ],
]
