import OpenAI from 'openai'
import * as e2b from '../dist/cjs/index.js'
import fs from 'node:fs'

const systemPrompt = `You're a helpful Python data analyst. Users ask you to solve data analysis problems and you solve them with running Python code. ALWAYS PRINT THE VARIABLES. The following Python packages are installed:
NumPy
Pandas
Matplotlib
SciPy
Scikit-learn
NLTK
Requests
Beautiful Soup
SQLAlchemy`

const history = [
  {
    role: 'system',
    content: systemPrompt,
  },
  {
    role: 'user',
    content:
      'I uploaded a CSV file here "/home/user/data.csv". What can you tell me about the data in this csv file?',
  },
  {
    role: 'assistant',
    content:
      "Let's start by loading the data and then we can explore its general characteristics such as the number of rows and columns, column names and types, missing values, and basic statistics.",
  },
  {
    role: 'assistant',
    content:
      "import pandas as pd\nfile_path = '/home/user/data.csv'\ncsv_data = pd.read_csv(file_path)\nbasic_info = csv_data.info()\nhead_data = csv_data.head()\ndesc_stats = csv_data.describe(include='all')\nprint(basic_info)\nprint(head_data)\nprint(desc_stats)",
    name: 'run_python_code',
  },
]

const desc =
  'Run Python code from file. You have access to the internet and can load and save files from the "/home/user" directory'

const functions = [
  {
    name: 'run_python_code',
    description: desc,
    parameters: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'The Python code to run. Make sure to properly JSON escape it.',
        },
      },
    },
    required: ['code'],
  },
]

let s
const openai = new OpenAI()

async function chat() {
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: history,
    functions,
  })
  return response
}

function respond(msg) {
  history.push({
    role: 'user',
    content: msg,
  })
  return chat()
}

function handleArtifact(artifact) {
  console.log('ARTIFACT')
  console.log(artifact)
}

async function startSession() {
  s = await e2b.DataAnalysis.create()

  const localFile = fs.readFileSync('/Users/mlejva/Downloads/netflix.csv')
  const remotePath = await s.uploadFile(localFile, 'netflix.csv')
  return remotePath
}

async function runPython(code) {
  const { stdout, stderr } = await s.runPython(code, {
    onStdout: out => console.log(out.line),
    onStderr: out => console.error(out.line),
    onArtifact: handleArtifact,
  })
  if (stderr) {
    respond(`I ran your code and got the following error: ${stderr}`)
  } else if (stdout) {
    respond(`I ran your code and this is the output: ${stdout}`)
  }
  // for (const artifact of artifacts) {
  //   // const data = await s.downloadFile(artifact.path, 'buffer')
  //   // fs.writeFileSync(artifact.path, data)
  // }
}

async function runFunction(name, args) {
  if (name === 'run_python_code') {
    await runPython(args.code)
  }
}

const remoteCSVFilePath = await startSession()

const response = await respond(
  `I uploaded a CSV file here "${remoteCSVFilePath}". What can you tell me about the data in this csv file?`,
)

const choice = response.choices[0]
if (choice.finish_reason === 'stop') {
  console.log('DONE')
} else if (choice.finish_reason === 'function_call') {
  const functionName = choice.message.function_call.name
  const functionsArgsStr = choice.message.function_call.arguments
  console.log(functionsArgsStr)
  const functionArgs = JSON.parse(functionsArgsStr)
  await runFunction(functionName, functionArgs)
} else {
  console.log('unexpected finish reason', choice.finish_reason)
}

// const response = await openai.chat.completions.create({
//   model: 'gpt-4',
//   messages: history,
//   functions,
// })

await s.close()
