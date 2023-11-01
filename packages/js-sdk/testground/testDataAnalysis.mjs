import OpenAI from 'openai'
import * as e2b from '../dist/cjs/index.js'
import readline from 'node:readline'
import fs from 'node:fs'
import MarkdownIt from 'markdown-it'
import { JSDOM } from 'jsdom'

const md = new MarkdownIt()

let codeSnippets = []

function askUserQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  return new Promise(resolve =>
    rl.question(query, ans => {
      rl.close()
      resolve(ans)
    })
  )
}

const systemPrompt = `You're a helpful Python data analyst. Always make sure all libraries are properly imported. Users ask you to solve data analysis problems and you solve them with running Python code. ALWAYS PRINT THE VARIABLES YOU WANT SHOW TO USER. The following Python packages are installed:
NumPy
Pandas
Matplotlib
SciPy
Scikit-learn
NLTK
Requests
Beautiful Soup
SQLAlchemy`

const exampleCodeInMarkdown = fs.readFileSync(
  '/Users/mlejva/Developer/e2b/packages/js-sdk/testground/code.md',
  'utf8'
)
const history = [
  {
    role: 'system',
    content: systemPrompt
  },
  {
    role: 'user',
    content:
      'I uploaded a CSV file here "/home/user/data.csv". What can you tell me about the data in this csv file?'
  },
  {
    role: 'assistant',
    content: `Let's start by loading the data and then we can explore its general characteristics such as the number of rows and columns, column names and types, missing values, and basic statistics. ${exampleCodeInMarkdown}`
  }
  // {
  //   role: 'assistant',
  //   content: ``,
  // },
]

const desc =
  'Run Python code from file. You have access to the internet and can load and save files from the "/home/user" directory. ALWASY WRITE CORRECT PYTHON CODE'

const functions = [
  {
    name: 'run_python_code',
    description: desc,
    parameters: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'The Python code to run in Markdown format.'
        }
      }
    },
    required: ['code']
  }
]

let s
const openai = new OpenAI()

async function chat() {
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: history
    // functions,
  })
  return response
}

function respond(msg) {
  history.push({
    role: 'user',
    content: msg
  })
  return chat()
}

async function handleArtifact(artifact) {
  const path = '/Users/mlejva/Developer/e2b/packages/js-sdk/testground/chart.png'
  const file = await artifact.download('buffer')
  fs.writeFileSync(path, file)
  console.log('Chart saved to ', `file://${path}`)
}

async function startSandbox() {
  s = await e2b.DataAnalysis.create()

  const localFile = fs.readFileSync('/Users/mlejva/Downloads/netflix.csv')
  const remotePath = await s.uploadFile(localFile, 'netflix.csv')
  return remotePath
}

async function runPython(code) {
  const { stdout, stderr } = await s.runPython(code, {
    onStdout: out => console.log(out.line),
    onStderr: out => console.error(out.line),
    onArtifact: handleArtifact
  })

  if (stderr) {
    // fs.writeFileSync(
    //   '/Users/mlejva/Developer/e2b/packages/js-sdk/testground/code.txt',
    //   code,
    // )
    // codeSnippets.pop()
    console.log('Got an error in code, fixing mysekf...')
    const response = await respond(
      `I ran your code and got the following error: ${stderr}`
    )

    await parseResponse(response)
  } else if (stdout) {
    const response = await respond(`I ran your code and this is the output: ${stdout}`)
    await parseResponse(response)
  }
}

function getPythonCodeSnippets(content) {
  const html = md.render(content)
  const dom = new JSDOM(html)
  const snippets = []
  dom.window.document.querySelectorAll('pre').forEach(pre => {
    if (pre.textContent) {
      // console.log('SNIPPET')
      // console.log(pre.textContent)
      snippets.push(pre.textContent)
    }
  })
  return snippets
}

async function parseResponse(response) {
  const choice = response.choices[0]
  // console.log('==== CHOICE')
  // console.log(choice)
  // console.log('====')

  if (choice.finish_reason === 'stop') {
    const content = choice.message.content
    const snippets = getPythonCodeSnippets(content)

    if (snippets.length > 0) {
      const newCode = snippets[0]
      // codeSnippets.push(newCode)
      // await runFunction('run_python_code', { code: codeSnippets.join('\n') })
      await runFunction('run_python_code', { code: newCode })
    } else {
      console.log(content)
      const ans = await askUserQuestion('> ')
      const response = await respond(ans)
      await parseResponse(response)
    }
  } else if (choice.finish_reason === 'function_call') {
    // const functionName = choice.message.function_call.name
    // const functionsArgsStr = choice.message.function_call.arguments
    // console.log(functionsArgsStr)
    // process.exit()
    // const functionArgs = JSON.parse(functionsArgsStr)
    // await runFunction(functionName, functionArgs)
  } else {
    console.log('unexpected finish reason', choice.finish_reason)
  }
}

async function runFunction(name, args) {
  if (name === 'run_python_code') {
    await runPython(args.code)
  }
}

const remoteCSVFilePath = await startSandbox()

const response = await respond(
  `I uploaded a CSV file here "${remoteCSVFilePath}". What can you tell me about the data in this csv file?`
)
await parseResponse(response)

// const response = await openai.chat.completions.create({
//   model: 'gpt-4',
//   messages: history,
//   functions,
// })

await s.close()
