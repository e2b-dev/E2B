// eslint-disable-next-line @typescript-eslint/no-var-requires
const { MarkdownPageEvent } = require('typedoc-plugin-markdown')

function load(app) {
  // Listen to the render event
  app.renderer.on(MarkdownPageEvent.END, (page) => {
    // Remove Markdown links from the document contents
    page.contents = removeMarkdownLinks(
      removeFirstNLines(
        convertH5toH3(removeLinesWithConditions(page.contents)),
        6
      )
    )
  })
}

// this is a hacky way to make methods in the js-sdk reference look more prominent
function convertH5toH3(text) {
  return text.replace(/^##### (.*)$/gm, '### $1')
}

// Function to remove Markdown-style links
function removeMarkdownLinks(text) {
  // Regular expression to match Markdown links [text](url)
  return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1') // Replace with just the link text
}

function removeFirstNLines(text, n) {
  // Split the text into lines, then join back excluding the first four lines
  return text.split('\n').slice(n).join('\n')
}

// Function to remove lines based on conditions
function removeLinesWithConditions(text) {
  const lines = text.split('\n')
  const filteredLines = []

  for (let i = 0; i < lines.length; i++) {
    // Check if the current line starts with "#### Extends" or "###### Overrides"
    if (
      lines[i].startsWith('#### Extends') ||
      lines[i].startsWith('###### Overrides') ||
      lines[i].startsWith('###### Inherited from')
    ) {
      // If it does, skip this line and the next three lines
      i += 3 // Skip this line and the next three
      continue
    }

    if (lines[i].startsWith('##### new')) {
      // avoid promoting constructors
      i += 1
      continue
    }

    // If not removed, add the line to filteredLines
    filteredLines.push(convertH5toH3(lines[i]))
  }

  // Join the filtered lines back into a single string
  return filteredLines.join('\n')
}

// Export the load function
module.exports = { load }
