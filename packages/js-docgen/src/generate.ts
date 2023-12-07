// Moves generated API reference docs from the 'api-ref-docs/' directory to the '/apps/docs' nextjs app inside this monorepo.
// Run this script from the root of the js-sdk package.
// import fs from 'fs'
// import path from 'path'
import { ApiModel } from '@microsoft/api-extractor-model'
import { MarkdownDocumenter } from './CustomMarkdownDocumenter'

// const apiRefDocsDir = path.join(process.cwd(), 'api-ref-docs')

// const apiRefDocs = fs.readdirSync(apiRefDocsDir)
// // Read all *.md files inside `apiRefDocs`
// const docsFiles = apiRefDocs.filter((file) => file.endsWith('.md'))

// const transformation = []

// let counter = 0
// for (const docFile of docsFiles) {
//   counter += 1
//   if (docFile === 'index.md') {
//     continue
//   }

//   transformation.push({
//     originaleName: docFile,
//     source: path.join(apiRefDocsDir, docFile),
//     // TODO
//     target: path.join(process.cwd(), '..', 'apps', 'docs', 'src', 'app', 'reference', docFile)
//   })
//   console.log(docFile)

//   if (counter > 1) {
//     break
//   }
// }

// // const docsFilePaths = docsFiles.map((file) => path.join(apiRefDocsDir, file))
// // console.log(docsFilePaths)


// // const targetPaths = []


export function generate(jsonPath: string, outputDir: string): void {
  const apiModel = new ApiModel();
  apiModel.loadPackage(jsonPath);

  const markdownDocumenter: MarkdownDocumenter = new MarkdownDocumenter({
    apiModel: apiModel,
    documenterConfig: undefined,
    outputFolder: outputDir,
  });
  markdownDocumenter.generateFiles();
}

generate(`${process.cwd()}/../js-sdk/api-extractor/sdk.api.json`, `${process.cwd()}/../js-sdk/docs`)